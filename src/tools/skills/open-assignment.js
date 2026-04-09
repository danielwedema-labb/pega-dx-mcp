import { z } from 'zod';
import { BaseTool } from '../../registry/base-tool.js';
import { getSessionCredentialsSchema } from '../../utils/tool-schema.js';
import { is_editable, parse_dx_response } from '../../utils/parser/dx_api_model_procs.js';
import { app_context_t } from '../../utils/parser/dx_api_app_types.js';
import { component_type_t } from '../../utils/parser/dx_api_model_types.js';

export class OpenAssignmentTool extends BaseTool {
  static getCategory() {
    return 'skills';
  }

  static getDefinition() {
    return {
      name: 'open_assignment',
      description: `Open an assignment for a case. Given a full case ID, retrieves available assignments and either:
- Opens the assignment directly if there is only one
- Lists available assignments and asks the user to select one if there are multiple

Use this as the primary entry point when a user wants to work on an assignment without knowing the assignment ID upfront.`,
      inputSchema: z.object({
        caseID: z.string().describe('Full case ID including space separator. Example: "MYORG-APP-WORK C-1001".'),
        assignmentID: z.string().optional().describe('Assignment ID to open directly. Only needed when multiple assignments exist and the user has chosen one.'),
        sessionCredentials: getSessionCredentialsSchema().optional()
      })
    };
  }

  async execute(params) {
    const { caseID, assignmentID } = params;
    let sessionInfo = null;

    try {
      sessionInfo = this.initializeSessionConfig(params);

      const requiredValidation = this.validateRequiredParams(params, ['caseID']);
      if (requiredValidation) return requiredValidation;

      // Step 1: fetch case to discover available assignments
      const caseResult = await this.pegaClient.getCase(caseID.trim(), { viewType: 'page' });

      if (!caseResult.success) {
        return this.createErrorResponse(`Open Assignment: ${caseID}`, caseResult.error);
      }

      const assignments = caseResult.data?.data?.caseInfo?.assignments ?? [];

      if (assignments.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `## Open Assignment: ${caseID}\n\nNo open assignments found for this case.\n\nThe case may be completed or waiting for an external event.\n\n*Checked at: ${new Date().toISOString()}*`
          }]
        };
      }

      // Determine which assignment to open
      let targetAssignmentID;

      if (assignmentID) {
        // User specified an assignment — validate it exists
        const match = assignments.find(a => a.ID === assignmentID);
        if (!match) {
          const list = assignments.map(a => `- \`${a.ID}\` — ${a.name || a.processName || 'Assignment'}`).join('\n');
          return {
            content: [{
              type: 'text',
              text: `## Open Assignment: ${caseID}\n\nAssignment \`${assignmentID}\` was not found on this case.\n\n**Available assignments:**\n\n${list}\n\nPlease provide a valid assignment ID.`
            }]
          };
        }
        targetAssignmentID = assignmentID;
      } else if (assignments.length === 1) {
        // Only one assignment — open it automatically
        targetAssignmentID = assignments[0].ID;
      } else {
        // Multiple assignments — ask the user to choose
        const rows = assignments
          .map(a => `| \`${a.ID}\` | ${a.name || a.processName || 'N/A'} | ${a.status || 'N/A'} |`)
          .join('\n');
        return {
          content: [{
            type: 'text',
            text: `## Open Assignment: ${caseID}\n\nThis case has multiple open assignments:\n\n| Assignment ID | Name | Status |\n| --- | --- | --- |\n${rows}\n\nWhich assignment would you like to open?`
          }]
        };
      }

      // Step 2: fetch full assignment details
      return this.executeWithErrorHandling(
        `Assignment Details: ${targetAssignmentID}`,
        async () => await this.pegaClient.getAssignment(targetAssignmentID, { viewType: 'form' }),
        { assignmentID: targetAssignmentID, viewType: 'form', sessionInfo }
      );
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `## Error: Open Assignment\n\n**Unexpected Error**: ${error.message}\n\n*Error occurred at: ${new Date().toISOString()}*`
        }]
      };
    }
  }

  formatSuccessResponse(operation, data, options = {}) {
    const app = new app_context_t();
    parse_dx_response(app, JSON.stringify(data));
    const root_component = app.resources.components.get(app.root_component_key);
    const caseId = app.case_info.id;
    const assignmentId = app.case_info.assignments.keys().next().value;
    const actionId = app.case_info.assignments.get(assignmentId)?.actions?.keys().next().value;
    return `
## ${operation}
- case ID: ${caseId}
- assignment ID: ${assignmentId}
- action ID: ${actionId}
${this.drawComponentR(root_component, app)}`;
  }

  is_visible(app, component) {
    const visibility = JSON.parse(component.json)?.config?.visibility;
    if (typeof visibility === 'boolean') {
      return visibility;
    }
    if (typeof visibility === 'string') {
      if (visibility.startsWith('@W')) {
        const when = app.case_info.content.get('summary_of_when_conditions__');
        if (!when) {
          return true;
        }
        return when[visibility.replace('@W ', '')];
      }
      if (visibility.startsWith('@E')) {
        let expression = visibility.replace('@E ', '');
        while (expression.startsWith('\.')) {
          const startIdx = expression.indexOf('\.');
          const endIdx = expression.indexOf(' ', startIdx);
          const name = expression.substring(startIdx + 1, endIdx);
          const value = app.case_info.content.get(name) || '';
          expression = expression.replace(`.${name}`, `'${value}'`);
        }
        expression = expression.replace(/ AND /ig, ' && ').replace(/ OR /ig, ' || ');
        expression = expression.replace(/(.+) NOT_STARTS_WITH (.+)/, '!$1.startsWith($2)');
        expression = expression.replace(/(.+) STARTS_WITH (.+)/, '$1.startsWith($2)');
        expression = expression.replace(/(.+) NOT_ENDS_WITH (.+)/, '!$1.endsWith($2)');
        expression = expression.replace(/(.+) ENDS_WITH (.+)/, '$1.endsWith($2)');
        expression = expression.replace(/(.+) NOT_CONTAINS (.+)/, '!$1.includes($2)');
        expression = expression.replace(/(.+) CONTAINS (.+)/, '$1.includes($2)');
        expression = expression.replace(/(.+) IS_NOT_NULL/, '!$1');
        expression = expression.replace(/(.+) IS_NULL/, '!!$1');
        expression = expression.replace(/(.+) IS_NOT_IN_LIST (.+)/, '$2.split(",").includes($1)');
        expression = expression.replace(/(.+) IS_IN_LIST (.+)/, '$2.split(",").includes($1)');
        return eval(expression);
      }
    }
    return true;
  }

  drawComponentR(component, app) {
    if (!component || !this.is_visible(app, component)) {
      return null;
    }
    if (component.type === component_type_t.component_type_reference) {
      return this.drawComponentR(app.resources.components.get(component.key), app)
    }
    if ((
      component.type === component_type_t.component_type_text_area ||
      component.type === component_type_t.component_type_text_input ||
      component.type === component_type_t.component_type_integer ||
      component.type === component_type_t.component_type_checkbox ||
      component.type === component_type_t.component_type_date ||
      component.type === component_type_t.component_type_email ||
      component.type === component_type_t.component_type_phone ||
      component.type === component_type_t.component_type_currency ||
      component.type === component_type_t.component_type_decimal ||
      component.type === component_type_t.component_type_dropdown ||
      component.type === component_type_t.component_type_radio ||
      component.type === component_type_t.component_type_url
    ) &&
      (is_editable(component, app.resources.fields.get(component.key)))) {
      return `| ${component.name} | ${component.label} | ${[component_type_t.component_type_dropdown, component_type_t.component_type_radio].includes(component.type) ?
        `${component.options?.map(o => `${o.label} (key: ${o.key})`).join(', ')}` : ''} |`;
    }
    let result = '';
    if (component.instructions) {
      result += `\n## Instructions:\n${component.instructions}\n`;
    }
    if (component.type === component_type_t.component_type_region) {
      result += `\n## Required information:\n`;
      result += `| key | label | options |
| --- | --- | --- |
`;
    }
    result += component.children.map((child, idx) => this.drawComponentR(child, app)).join('\n');
    if (component.type === component_type_t.component_type_region) {
      // Important: ask for this information one by one and wait for the user to respond in between each.
      // Keep the users answers in context and use them to fill in the fields of the assignment when submitting it with the submit-assignment tool.
      // While asking the user for this information, there is no need to call any tool.
      result += `\n
Once the user has provided ALL of the above information, only then the assignment can be submitted using the submit-assignment tool.
To submit the assignment, use the key of each field with the provided value of the user as key-value pars in the content object of submit-assignment.\n`;
    }
    return result;
  }
}

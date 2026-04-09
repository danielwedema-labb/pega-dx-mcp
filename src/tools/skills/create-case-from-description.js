import { z } from 'zod';
import { BaseTool } from '../../registry/base-tool.js';
import { getSessionCredentialsSchema } from '../../utils/tool-schema.js';

export class CreateCaseSkillTool extends BaseTool {
  static getCategory() {
    return 'skills';
  }

  static getDefinition() {
    return {
      name: 'create_case_from_description',
      description: `Create a new case by describing the type of case you want to create. Automatically resolves the case type by matching the description against available case types, then creates the case.`,
      inputSchema: z.object({
        description: z.string().describe('Description of the case type to create. Example: "loan application", "complaint", "service request".'),
        caseTypeID: z.string().optional().describe('Case type ID to use directly, bypassing matching. Only needed when multiple case types matched and the user has chosen one.'),
        content: z.looseObject({}).optional().describe('Optional field values for case creation. Empty content is used if not provided.'),
        sessionCredentials: getSessionCredentialsSchema().optional()
      })
    };
  }

  async execute(params) {
    const { description, caseTypeID, content = {} } = params;
    let sessionInfo = null;

    try {
      sessionInfo = this.initializeSessionConfig(params);

      const requiredValidation = this.validateRequiredParams(params, ['description']);
      if (requiredValidation) return requiredValidation;

      // Step 1: fetch available case types
      const typesResult = await this.pegaClient.getCaseTypes();

      if (!typesResult.success) {
        return this.createErrorResponse(`Create Case: ${description}`, typesResult.error);
      }

      const caseTypes = typesResult.data?.caseTypes ?? [];

      if (caseTypes.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `## Create Case: ${description}

No case types are available for creation.

*Checked at: ${new Date().toISOString()}*`
          }]
        };
      }

      // Step 2: resolve which case type to use
      let targetTypeID;

      if (caseTypeID) {
        // User specified a type directly — validate it exists
        const match = caseTypes.find(ct => ct.ID === caseTypeID);
        if (!match) {
          const list = caseTypes.map(ct => `| \`${ct.ID}\` | ${ct.name} |`).join('\n');
          return {
            content: [{
              type: 'text',
              text: `## Create Case: ${description}

Case type \`${caseTypeID}\` was not found.

**Available case types:**

| Case Type ID | Name |
| --- | --- |
${list}

Please provide a valid case type ID.`
            }]
          };
        }
        targetTypeID = caseTypeID;
      } else {
        // Match description against case type names
        const needle = description.toLowerCase();
        const matches = caseTypes.filter(ct =>
          ct.name?.toLowerCase().includes(needle) ||
          ct.ID?.toLowerCase().includes(needle)
        );

        if (matches.length === 1) {
          targetTypeID = matches[0].ID;
        } else if (matches.length === 0) {
          const list = caseTypes.map(ct => `| \`${ct.ID}\` | ${ct.name} |`).join('\n');
          return {
            content: [{
              type: 'text',
              text: `## Create Case: ${description}

**Available case types:**

| Case Type ID | Name |
| --- | --- |
${list}

What action would the user like to take? Only read the case name, NOT the case type ID. Avoid calling it a 'casetype', instead just refer to the name.`
            }]
          };
        } else {
          const list = matches.map(ct => `| \`${ct.ID}\` | ${ct.name} |`).join('\n');
          return {
            content: [{
              type: 'text',
              text: `## Create Case: ${description}

Multiple case types matched "${description}":

| Case Type ID | Name |
| --- | --- |
${list}

What action would the user like to take? Only read the case name, NOT the case type ID. Avoid calling it a 'casetype', instead just refer to the name.`
            }]
          };
        }
      }

      // Step 3: create the case
      return this.executeWithErrorHandling(
        `Create Case: ${targetTypeID}`,
        async () => await this.pegaClient.createCase({ caseTypeID: targetTypeID, content }),
        { sessionInfo }
      );
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `## Error: Create Case

**Unexpected Error**: ${error.message}

*Error occurred at: ${new Date().toISOString()}*`
        }]
      };
    }
  }

  /**
 * Override formatSuccessResponse to add case-specific formatting
 */
  formatSuccessResponse(operation, data, options = {}) {
    const { sessionInfo } = options;
    const caseId = data.ID || data.caseInfo?.ID;
    const eTag = data.etag;
    const caseInfo = data.data?.caseInfo;
    const content = Object.keys(caseInfo?.content ?? {}).length > 0 && caseInfo?.content;
    const nextAssignmentID = data.nextAssignmentInfo?.ID || data.caseInfo?.nextAssignmentID;
    const assignment = caseInfo.assignments[0];

    return `## ${operation}

${caseId ? `
### ✅ New Case ID: ${data.ID || data.caseInfo?.ID}` : ''}

${eTag && `
  **eTag**: ${eTag}
  *Save this eTag for future case updates*`}
    
${nextAssignmentID && `
### Next Assignment (Automatically Created)
- **Assignment ID**: ${nextAssignmentID || 'N/A'}
- **Name**: ${assignment.name || 'N/A'}
- **Process**: ${assignment.processName || 'N/A'}`}

Mention to the user that the above assignment is available. Use the Assignment ID in the open-assignment tool to retrieve it's details.
    `;
  }

  formatSessionInfo(sessionInfo) {
    if (!sessionInfo) return '';
    return `
### Session Information
- **Session ID**: ${sessionInfo.sessionId}
- **Authentication Mode**: ${sessionInfo.authMode.toUpperCase()}
- **Configuration Source**: ${sessionInfo.configSource}`
  }

  formatCaseInfo(caseInfo) {
    return `### Case Information
- **Case Type**: ${caseInfo.caseTypeName || 'N/A'}
- **Status**: ${caseInfo.status || 'N/A'}
- **Stage**: ${caseInfo.stage || 'N/A'}
- **Step**: ${caseInfo.step || 'N/A'}
- **Urgency**: ${caseInfo.urgency || 'N/A'}
- **Created**: ${caseInfo.createTime || 'N/A'}
- **Created By**: ${caseInfo.createOpName || 'N/A'}`
  }

  formatCaseContent(content) {
    return `
### Case Content
${Object.entries(caseInfo.content).map(([key, value]) => `- **${key}**: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join('\n')}`
  }
}

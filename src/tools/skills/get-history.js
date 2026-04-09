import { z } from 'zod';
import { BaseTool } from '../../registry/base-tool.js';
import { getSessionCredentialsSchema } from '../../utils/tool-schema.js';

export class GetHistoryTool extends BaseTool {
  static getCategory() {
    return 'skills';
  }

  static getDefinition() {
    return {
      name: 'get_history',
      description: 'Get the audit history for a case. Returns a chronological list of events such as status changes, assignments, actions performed, and operator activity.',
      inputSchema: z.object({
        caseID: z.string().describe('Full case ID including space separator. Example: "MYORG-APP-WORK C-1001".'),
        sessionCredentials: getSessionCredentialsSchema().optional()
      })
    };
  }

  async execute(params) {
    const { caseID } = params;
    let sessionInfo = null;

    try {
      sessionInfo = this.initializeSessionConfig(params);

      const requiredValidation = this.validateRequiredParams(params, ['caseID']);
      if (requiredValidation) return requiredValidation;

      const result = await this.pegaClient.getListDataView('D_pyWorkHistory', {
        dataViewParameters: { CaseInstanceKey: caseID.trim() }
      });

      if (!result.success) {
        return this.createErrorResponse(`Case History: ${caseID}`, result.error);
      }

      const rows = result.data?.data ?? result.data ?? [];

      if (!Array.isArray(rows) || rows.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `## Case History: ${caseID}\n\nNo history entries found.\n\n*Checked at: ${new Date().toISOString()}*`
          }]
        };
      }

      const tableRows = rows
        .map(row => `| ${row.pxTimeCreated ?? ''} | ${row.pyPerformer ?? ''} | ${row.pyMessageKey ?? ''} |`)
        .join('\n');

      return {
        content: [{
          type: 'text',
          text: `## Case History: ${caseID}\n\n${rows.length} event(s) found.\n\n| Time | Operator | Message |\n| --- | --- | --- | --- |\n${tableRows}\n\n*Retrieved at: ${new Date().toISOString()}*`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `## Error: Case History\n\n**Unexpected Error**: ${error.message}\n\n*Error occurred at: ${new Date().toISOString()}*`
        }]
      };
    }
  }
}

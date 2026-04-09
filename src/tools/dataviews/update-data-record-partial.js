import { z } from 'zod';
import { BaseTool } from '../../registry/base-tool.js';
import { getSessionCredentialsSchema } from '../../utils/tool-schema.js';

export class UpdateDataRecordPartialTool extends BaseTool {
  /**
   * Get the category this tool belongs to
   */
  static getCategory() {
    return 'dataviews';
  }

  /**
   * Get tool definition for MCP protocol
   */
  static getDefinition() {
    return {
      name: 'update_data_record_partial',
      description: 'Partially update an existing data record based on conditional save plan configured for a savable Data Page. Only updates the provided fields, leaving other fields unchanged. Note: Not supported for PEGA System of records.',
      inputSchema: z.object({
        dataViewID: z.string().describe('ID of savable Data Page to update. a valid, existing data view identifier.'),
        data: z.looseObject({}).describe('Data object containing properties to update in the data record. Only the specified properties will be updated, other fields remain unchanged.'),
        eTag: z.string().optional().describe('Optional. Auto-fetched if omitted. For faster execution, use eTag from previous response.'),
        pageInstructions: z.array(z.object({
          instruction: z.enum(['UPDATE', 'REPLACE', 'DELETE', 'APPEND', 'INSERT', 'MOVE']).describe('Page instruction type. UPDATE (add fields to page), REPLACE (replace entire page), DELETE (remove page), APPEND (add item to page list), INSERT (insert item in page list), MOVE (reorder page list items)'),
          target: z.string().describe('Target embedded page name'),
          content: z.looseObject({}).optional().describe('Content to set on the embedded page (required for UPDATE and REPLACE)')
        }).describe('Page operation for embedded pages. Use REPLACE instruction to set embedded page references with full object including pzInsKey. Example: {"instruction": "REPLACE", "target": "PageName", "content": {"Property": "value", "pyID": "ID-123", "pzInsKey": "CLASS-NAME ID-123"}}')).optional().describe('Optional list of page-related operations for embedded pages, page lists, or page groups. Required for setting embedded page references.'),
        sessionCredentials: getSessionCredentialsSchema().optional()
      })
    };
  }

  /**
   * Execute the partial update data record operation
   */
  async execute(params) {
    const { dataViewID, data, eTag, pageInstructions } = params;
    let sessionInfo = null;

    try {
      sessionInfo = this.initializeSessionConfig(params);

      // Validate required parameters
      const requiredValidation = this.validateRequiredParams(params, ['dataViewID', 'data']);
      if (requiredValidation) {
        return requiredValidation;
      }

      // Validate that data is an object
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return {
          error: 'Invalid data parameter. data must be a valid object containing the record properties to update.'
        };
      }

      // Execute with standardized error handling
      return await this.executeWithErrorHandling(
        `Partial Data Record Update: ${dataViewID}`,
        async () => await this.pegaClient.updateDataRecordPartial(dataViewID, data, { eTag, pageInstructions }),
        { sessionInfo }
      );
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `## Error: Partial Data Record Update: ${dataViewID}\n\n**Unexpected Error**: ${error.message}\n\n${sessionInfo ? `**Session**: ${sessionInfo.sessionId} (${sessionInfo.authMode} mode)\n` : ''}*Error occurred at: ${new Date().toISOString()}*`
        }]
      };
    }
  }
}

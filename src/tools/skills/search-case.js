import { z } from 'zod';
import { BaseTool } from '../../registry/base-tool.js';
import { getSessionCredentialsSchema } from '../../utils/tool-schema.js';

export class SearchCaseTool extends BaseTool {
  static getCategory() {
    return 'skills';
  }

  static getDefinition() {
    return {
      name: 'search_case',
      description: `Search for a Pega case by various filters, and retrieve its full case ID.

Performs a two-step lookup:
1. Queries the specified data view filtering on the short case ID to resolve the full case ID
2. Returns the full case ID which can be used to get the full case details

Use this when you have a short or partial case ID and need the full case ID.`,
      inputSchema: z.object({
        searchString: z.string().describe('The information to search for, e.g. a short case ID '),
        status: z.string().optional().describe('The status of the case to filter on, e.g. "blocked" or "pending" or "new" or "open" or "resolved". Multiple values possible as comma-separated values. Optional.'),
        updatedOn: z.enum(['Today', 'Yesterday', 'Last 7 days', 'Last 30 days', 'Last 90 days']).optional().describe('The last updated time frame to filter on. Optional.'),
        sessionCredentials: getSessionCredentialsSchema().optional()
      })
    };
  }

  async execute(params) {
    const {
      searchString,
      status = '',
      updatedOn = ''
    } = params;
    let sessionInfo = null;

    try {
      sessionInfo = this.initializeSessionConfig(params);

      const requiredValidation = this.validateRequiredParams(params, ['searchString']);
      if (requiredValidation) return requiredValidation;

      // Step 1: search the data view for the short case ID
      const searchResult = await this.pegaClient.getListDataView('D_pySearch', {
        dataViewParameters: {
          SearchString: searchString,
          Status: status.split(',').filter(s => !!s).map(s => `\\"${s}\\"`).join(','),
          UpdatedOn: updatedOn
        }
      });

      if (!searchResult.success) {
        return this.createErrorResponse(`Search Case: ${searchString}`, searchResult.error);
      }

      const rows = searchResult.data?.data ?? searchResult.data;
      const idField = 'pzInsKey';

      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `## Search Case: ${searchString}\n\nNo case found matching "${searchString}".\n\n*Searched at: ${new Date().toISOString()}*`
          }]
        };
      }

      if (rows.length > 1) {
        const list = rows.map((row, i) => `| ${row[idField]}| ${row.pyStatusWork ?? ''} | ${row.pzWorkCreatedOn ?? ''} | ${row.pxCreateOpName ?? ''} |`).join('\n');
        return {
          content: [{
            type: 'text',
            text: `Multiple cases found matching "${searchString}":

| Case ID | Status | Created on | Created by |
| --- | --- | --- | --- |
${list}

Please ask the user which case they mean by providing the full case ID.`
          }]
        };
      }

      // Step 2: resolve the full case ID and fetch case details
      const fullCaseID = rows[0][idField];

      if (!fullCaseID) {
        return {
          content: [{
            type: 'text',
            text: `Case found but field **${idField}** is missing from the result. Cannot retrieve full case details.
            
Data view row:
\`\`\`json
${JSON.stringify(rows[0], null, 2)}
\`\`\`
`
          }]
        };
      }

      return await this.executeWithErrorHandling(
        `Case Details: ${fullCaseID} (resolved from "${searchString}")`,
        async () => await this.pegaClient.getCase(fullCaseID.trim()),
        { sessionInfo }
      );
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `## Error: Search Case: ${searchString}
          
**Unexpected Error**: ${error.message}
`
        }]
      };
    }
  }
}

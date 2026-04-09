import { z } from 'zod';
import { BaseTool } from '../../registry/base-tool.js';
import { getSessionCredentialsSchema } from '../../utils/tool-schema.js';

export class DeleteRelatedCaseTool extends BaseTool {
  /**
   * Get the category this tool belongs to
   */
  static getCategory() {
    return 'related_cases';
  }

  /**
   * Get tool definition for MCP protocol
   */
  static getDefinition() {
    return {
      name: 'delete_related_case',
      description: 'Remove related work association between two cases by deleting a specific relationship',
      inputSchema: z.object({
        caseID: z.string().describe('Primary case ID from which to remove the related case. Example: "ON6E5R-DIYRecipe-Work-RecipeCollection R-1008". a complete case identifier including spaces and special characters.'),
        related_caseID: z.string().describe('Related case ID to be removed from the primary case. Example: "ON6E5R-DIYRecipe-Work-RecipeCollection R-1009". a complete case identifier including spaces and special characters.'),
        sessionCredentials: getSessionCredentialsSchema().optional()
      })
    };
  }

  /**
   * Execute the delete related case operation
   */
  async execute(params) {
    const { caseID, related_caseID } = params;
    let sessionInfo = null;

    try {
      sessionInfo = this.initializeSessionConfig(params);

      // Validate required parameters using base class
      const requiredValidation = this.validateRequiredParams(params, ['caseID', 'related_caseID']);
      if (requiredValidation) {
        return requiredValidation;
      }

      // Execute with standardized error handling
      return await this.executeWithErrorHandling(
        `Delete Related Case: ${related_caseID} from ${caseID}`,
        async () => await this.pegaClient.deleteRelatedCase(caseID.trim(), related_caseID.trim()),
        { sessionInfo }
      );
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `## Error: Delete Related Case: ${related_caseID} from ${caseID}\n\n**Unexpected Error**: ${error.message}\n\n${sessionInfo ? `**Session**: ${sessionInfo.sessionId} (${sessionInfo.authMode} mode)\n` : ''}*Error occurred at: ${new Date().toISOString()}*`
        }]
      };
    }
  }
}

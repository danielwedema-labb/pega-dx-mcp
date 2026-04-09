import { z } from 'zod';
import { BaseTool } from '../../registry/base-tool.js';
import { getSessionCredentialsSchema } from '../../utils/tool-schema.js';

export class UpdateParticipantTool extends BaseTool {
  /**
   * Get the category this tool belongs to
   */
  static getCategory() {
    return 'participants';
  }

  /**
   * Get tool definition for MCP protocol
   */
  static getDefinition() {
    return {
      name: 'update_participant',
      description: 'Update participant details in a Pega case by case ID and participant ID. If no eTag is provided, automatically fetches the latest eTag from the case for seamless operation. Allows updating participant information such as contact details, personal information, and other properties. Requires an eTag value for optimistic locking and returns updated participant details with optional UI resources.',
      inputSchema: z.object({
        caseID: z.string().describe('Case ID. Example: "MYORG-APP-WORK C-1001". Complete identifier including spaces."ON6E5R-DIYRecipe-Work-RecipeCollection R-1008". a complete case identifier including spaces and special characters.'),
        participantID: z.string().describe('Participant ID to update. This identifies the specific participant within the case whose information will be modified.'),
        eTag: z.string().optional().describe('Optional. Auto-fetched if omitted. For faster execution, use eTag from previous response. a non-empty string representing case save date time.'),
        content: z.object({
          pyFirstName: z.string().optional().describe('First name of the participant'),
          pyLastName: z.string().optional().describe('Last name of the participant'),
          pyEmail1: z.string().optional().describe('Email address of the participant'),
          pyPhoneNumber: z.string().optional().describe('Phone number of the participant'),
          pyWorkPartyUri: z.string().optional().describe('Unique identifier for the participant'),
          pyFullName: z.string().optional().describe('Full name of the participant'),
          pyTitle: z.string().optional().describe('Title of the participant')
        }).optional().describe('Participant information object containing user details such as name, email, phone, and other contact information. Structure matches Data-Party schema.'),
        viewType: z.enum(['form', 'none']).default('form').describe('UI resources to return. "form" returns form UI metadata, "none" returns no UI resources (default: "form")'),
        pageInstructions: z.array(z.object({
          instruction: z.enum(['UPDATE', 'REPLACE', 'DELETE', 'APPEND', 'INSERT', 'MOVE']).describe('Page instruction type. UPDATE (add fields to page), REPLACE (replace entire page), DELETE (remove page), APPEND (add item to page list), INSERT (insert item in page list), MOVE (reorder page list items)'),
          target: z.string().describe('Target embedded page name'),
          content: z.looseObject({}).optional().describe('Content to set on the embedded page (required for UPDATE and REPLACE)')
        })).optional().describe('Optional list of page-related operations for embedded pages, page lists, or page groups. Required for setting embedded page references.'),
        sessionCredentials: getSessionCredentialsSchema().optional()
      })
    };
  }

  /**
   * Execute the update participant operation
   */
  async execute(params) {
    const { caseID, participantID, eTag, content, pageInstructions, viewType } = params;
    let sessionInfo = null;

    try {
      sessionInfo = this.initializeSessionConfig(params);

      // Validate required parameters using base class
      const requiredValidation = this.validateRequiredParams(params, ['caseID', 'participantID']);
      if (requiredValidation) {
        return requiredValidation;
      }

      // Validate enum parameters using base class
      const enumValidation = this.validateEnumParams(params, {
        viewType: ['form', 'none']
      });
      if (enumValidation) {
        return enumValidation;
      }

      // Prepare options object for API call
      const options = {};
      if (content) {
        options.content = content;
      }
      if (pageInstructions) {
        options.pageInstructions = pageInstructions;
      }
      if (viewType) {
        options.viewType = viewType;
      }

      // Auto-fetch eTag if not provided
      let finalETag = eTag;
      let autoFetchedETag = false;

      if (!finalETag) {
        try {
          console.error(`Auto-fetching latest eTag for participant operation on ${caseID}...`);
          const caseResponse = await this.pegaClient.getCase(caseID.trim());

          if (!caseResponse || !caseResponse.success) {
            const errorMsg = `Failed to auto-fetch eTag: ${caseResponse?.error?.message || 'Unknown error'}`;
            return {
              error: errorMsg
            };
          }

          finalETag = caseResponse.eTag;
          autoFetchedETag = true;
          console.error(`Successfully auto-fetched eTag: ${finalETag}`);

          if (!finalETag) {
            const errorMsg = 'Auto-fetch succeeded but no eTag was returned from get_case. This may indicate a server issue.';
            return {
              error: errorMsg
            };
          }
        } catch (error) {
          const errorMsg = `Failed to auto-fetch eTag: ${error.message}`;
          return {
            error: errorMsg
          };
        }
      }

      // Validate eTag format (should be a timestamp-like string)
      if (typeof finalETag !== 'string' || finalETag.trim().length === 0) {
        return {
          error: 'Invalid eTag parameter. a non-empty string representing case save date time.'
        };
      }

      return await this.executeWithErrorHandling(
        `Update Participant: ${caseID.trim()} / ${participantID.trim()}`,
        async () => await this.pegaClient.updateParticipant(caseID.trim(), participantID.trim(), finalETag.trim(), options),
        {
          caseID: caseID.trim(),
          participantID: participantID.trim(),
          eTag: '***', // Hide eTag in logs for security
          hasContent: !!content,
          hasPageInstructions: !!pageInstructions,
          viewType,
          sessionInfo
        }
      );
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `## Error: Update Participant: ${caseID} / ${participantID}\n\n**Unexpected Error**: ${error.message}\n\n${sessionInfo ? `**Session**: ${sessionInfo.sessionId} (${sessionInfo.authMode} mode)\n` : ''}*Error occurred at: ${new Date().toISOString()}*`
        }]
      };
    }
  }
}

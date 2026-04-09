import { z } from 'zod';
import { BaseTool } from '../../registry/base-tool.js';
import { getSessionCredentialsSchema } from '../../utils/tool-schema.js';

export class CreateCaseParticipantTool extends BaseTool {
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
      name: 'create_case_participant',
      description: 'Create a new participant in a Pega case with specified role and participant information. If no eTag is provided, automatically fetches the latest eTag from the case for seamless operation. Adds users to case access control with appropriate permissions and role assignments.',
      inputSchema: z.object({
        caseID: z.string().describe('Case ID. Example: "MYORG-APP-WORK C-1001". Complete identifier including spaces."ON6E5R-DIYRecipe-Work-RecipeCollection R-1008". a complete case identifier including spaces and special characters.'),
        eTag: z.string().describe('Optional. Auto-fetched if omitted. For faster execution, use eTag from previous response. a non-empty string representing case save date time.'),
        content: z.object({
          pyFirstName: z.string().optional().describe('First name of the participant'),
          pyLastName: z.string().optional().describe('Last name of the participant'),
          pyEmail1: z.string().optional().describe('Email address of the participant'),
          pyPhoneNumber: z.string().optional().describe('Phone number of the participant'),
          pyWorkPartyUri: z.string().optional().describe('Unique identifier for the participant'),
          pyFullName: z.string().optional().describe('Full name of the participant'),
          pyTitle: z.string().optional().describe('Title of the participant')
        }).describe('Participant information object containing user details such as name, email, phone, and other contact information. Structure matches Data-Party schema.'),
        participantRoleID: z.string().describe('Role ID to assign to the participant. This determines the permissions and access level the participant will have for the case.'),
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
   * Execute the create case participant operation
   */
  async execute(params) {
    const { caseID, eTag, content, participantRoleID, viewType, pageInstructions } = params;
    let sessionInfo = null;

    try {
      sessionInfo = this.initializeSessionConfig(params);

      // Validate required parameters using base class
      const requiredValidation = this.validateRequiredParams(params, ['caseID', 'content', 'participantRoleID']);
      if (requiredValidation) {
        return requiredValidation;
      }

      // Validate enum parameters
      const enumValidation = this.validateEnumParams(params, {
        viewType: ['form', 'none']
      });
      if (enumValidation) {
        return enumValidation;
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
        `Create Participant: ${caseID}`,
        async () => await this.pegaClient.createCaseParticipant(caseID.trim(), {
          eTag: finalETag,
          content,
          participantRoleID,
          viewType,
          pageInstructions
        }),
        { caseID: caseID.trim(), participantRoleID, sessionInfo }
      );
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `## Error: Create Participant: ${caseID}\\n\\n**Unexpected Error**: ${error.message}\\n\\n${sessionInfo ? `**Session**: ${sessionInfo.sessionId} (${sessionInfo.authMode} mode)\\n` : ''}*Error occurred at: ${new Date().toISOString()}*`
        }]
      };
    }
  }
}

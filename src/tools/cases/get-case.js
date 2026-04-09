import { z } from 'zod';
import { BaseTool } from '../../registry/base-tool.js';
import { getSessionCredentialsSchema } from '../../utils/tool-schema.js';

export class GetCaseTool extends BaseTool {
  /**
   * Get the category this tool belongs to
   */
  static getCategory() {
    return 'cases';
  }

  /**
   * Get tool definition for MCP protocol
   */
  static getDefinition() {
    return {
      name: 'get_case',
      description: 'Get comprehensive case information. \n\n**Important**: The `caseID` must be a full case ID containing a space (e.g. "MYORG-APP-WORK C-1001"). If the provided ID contains no space, call the `search_case` tool first to resolve the full case ID before calling this tool.',
      inputSchema: z.object({
        caseID: z.string().describe('Case ID. Example: "MYORG-APP-WORK C-1001". Complete identifier including spaces.'),
        viewType: z.enum(['none', 'page']).optional().describe('UI resources to return. "none" returns no UI resources, "page" returns full page UI metadata'),
        pageName: z.string().optional().describe('If provided, view metadata for specific page name will be returned (only used when viewType is "page")'),
        originChannel: z.string().optional().describe('Origin of this service. E.g. - Web, Mobile etc.'),
        sessionCredentials: getSessionCredentialsSchema().optional()
      })
    };
  }

  /**
   * Execute the get case operation
   */
  async execute(params) {
    const { caseID, viewType, pageName, originChannel } = params;
    let sessionInfo = null;

    try {
      // Initialize session configuration if provided
      sessionInfo = this.initializeSessionConfig(params);

      // Validate required parameters using base class
    const requiredValidation = this.validateRequiredParams(params, ['caseID']);
    if (requiredValidation) {
      return requiredValidation;
    }

    // Validate enum parameters using base class
    const enumValidation = this.validateEnumParams(params, {
      viewType: ['none', 'page']
    });
    if (enumValidation) {
      return enumValidation;
    }

    // Validate pageName usage
    if (pageName && viewType !== 'page') {
      return {
        error: 'pageName parameter can only be used when viewType is set to "page".'
      };
    }

      // Execute with standardized error handling
      return await this.executeWithErrorHandling(
        `Case Details: ${caseID}`,
        async () => await this.pegaClient.getCase(caseID.trim(), { viewType, pageName, originChannel }),
        { caseID, viewType, pageName, originChannel, sessionInfo }
      );
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `## Error: Get Case

**Unexpected Error**: ${error.message}

${sessionInfo ? `**Session**: ${sessionInfo.sessionId} (${sessionInfo.authMode} mode)\n` : ''}*Error occurred at: ${new Date().toISOString()}*`
        }]
      };
    }
  }

  /**
   * Override formatSuccessResponse to display eTag information
   */
  formatSuccessResponse(operation, data, options = {}) {
    const { caseID, sessionInfo } = options;

    let response = `## ${operation}\n\n`;
    response += `*Operation completed at: ${new Date().toISOString()}*\n\n`;

    // Session Information (if applicable)
    if (sessionInfo) {
      response += `### Session Information\n`;
      response += `- **Session ID**: ${sessionInfo.sessionId}\n`;
      response += `- **Authentication Mode**: ${sessionInfo.authMode.toUpperCase()}\n`;
      response += `- **Configuration Source**: ${sessionInfo.configSource}\n\n`;
    }
    
    // Display eTag information prominently if available
    if (data.eTag) {
      response += '### 🔑 Current eTag Information\n';
      response += `- **eTag**: \`${data.eTag}\`\n`;
      response += '- **Usage**: Use this exact value as eTag parameter for update operations\n';
      response += '- **Format**: ISO date-time representing pxSaveDateTime\n\n';
    }

    // Add workflow guidance based on case state
    response += '\n### Next Steps\n\n';

    if (data.assignments && data.assignments.length > 0) {
      response += '**Available Assignments**: This case has open assignments:\n';
      data.assignments.forEach(assignment => {
        response += `- Use \`get_assignment\` with ID "${assignment.ID}" to work on this assignment\n`;
      });
    } else if (data.availableProcesses && data.availableProcesses.length > 0) {
      response += '**Available Processes**: This case can have optional processes added:\n';
      data.availableProcesses.forEach(process => {
        response += `- Use \`add_optional_process\` with process ID "${process.ID}"\n`;
      });
    } else {
      response += '**Case Status**: No open assignments. Case may be completed or waiting for external event.\n';
      response += '- Use `get_case_history` to view case audit trail\n';
      response += '- Use `get_case_stages` to view stage progression\n';
    }

    // Add the standard data formatting
    if (data && typeof data === 'object') {
      response += this.formatDataSection(data);
    }
    
    return response;
  }

}

import { z } from 'zod';
import { BaseTool } from '../../registry/base-tool.js';
import { getSessionCredentialsSchema } from '../../utils/tool-schema.js';

export class GetListDataViewTool extends BaseTool {
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
      name: 'get_list_data_view',
      description: `Retrieve list type data view with advanced querying capabilities. Supports 4 distinct use cases:

1. **Standard Data Retrieval**: Get data with pagination, filtering, and sorting
   Example: { "dataViewID": "D_Employees", "query": { "select": [{"field": "Name"}, {"field": "Age"}], "filter": { "filterConditions": { "F1": { "lhs": {"field": "Department"}, "comparator": "EQ", "rhs": {"value": "IT"} } }, "logic": "F1" } }, "paging": { "pageSize": 100 } }

2. **Aggregated Data**: Get aggregated data with optional grouping
   Example: { "dataViewID": "D_Employees", "query": { "aggregations": { "AvgAge": { "field": "age", "summaryFunction": "AVG" } }, "select": [{"field": "Department"}] }, "paging": { "maxResultsToFetch": 2000 } }

3. **Distinct Values**: Get unique values from filtered lists
   Example: { "dataViewID": "D_Employees", "query": { "select": [{"field": "Department"}], "distinctResultsOnly": true }, "paging": { "maxResultsToFetch": 1000 } }

4. **Non-queryable Data Views**: Simple data retrieval without querying
   Example: { "dataViewID": "D_SimpleData", "dataViewParameters": { "param1": "value1", "param2": "value2" } }

Filter comparators supported: boolean (IS_TRUE, IS_FALSE, IS_NULL, IS_NOT_NULL, EQ, NEQ), string (EQ, NEQ, IN, NOT_IN, IS_NULL, IS_NOT_NULL, STARTS_WITH, NOT_STARTS_WITH, ENDS_WITH, NOT_ENDS_WITH, CONTAINS, NOT_CONTAINS), number/date (EQ, NEQ, IN, NOT_IN, GT, GTE, LT, LTE, ISNULL, ISNOTNULL).

Aggregation functions: COUNT, MAX, MIN, DISTINCT_COUNT. For numbers: SUM, AVG.`,
      inputSchema: z.object({
        dataViewID: z.string().describe('Data view ID. Example: "D_CaseList"'),
        dataViewParameters: z.looseObject({}).optional().describe('Parameters for data views. Key-value pairs. Example: {"CustomerID": "C-123"}'),
        query: z.looseObject({}).optional().describe('Optional query object for filtering, sorting, aggregation, and field selection. If not specified, retrieves data as a regular data view.'),
        paging: z.looseObject({}).optional().describe('Optional pagination configuration. Can specify either maxResultsToFetch or pageNumber/pageSize combination, but not both.'),
        useExtendedTimeout: z.boolean().optional().describe('Optional flag that works only if the data view is sourced by a report definition. When set to true, increases timeout to 45 seconds. Otherwise, timeout is 10 seconds.'),
        sessionCredentials: getSessionCredentialsSchema().optional()
      })
    };
  }

  /**
   * Execute the get list data view operation
   */
  async execute(params) {
    const { dataViewID, dataViewParameters, query, paging, useExtendedTimeout } = params;
    let sessionInfo = null;

    try {
      sessionInfo = this.initializeSessionConfig(params);

      // Validate required parameters
      const requiredValidation = this.validateRequiredParams(params, ['dataViewID']);
      if (requiredValidation) {
        return requiredValidation;
      }

      // Build request body from optional parameters
      const requestBody = {};

      if (dataViewParameters) {
        requestBody.dataViewParameters = dataViewParameters;
      }

      if (query) {
        requestBody.query = query;
      }

      if (paging) {
        requestBody.paging = paging;
      }

      if (useExtendedTimeout !== undefined) {
        requestBody.useExtendedTimeout = useExtendedTimeout;
      }

      // Execute with standardized error handling
      return await this.executeWithErrorHandling(
        `List Data View: ${dataViewID}${query ? ' (with query)' : ''}${paging ? ' (paginated)' : ''}`,
        async () => await this.pegaClient.getListDataView(dataViewID, requestBody),
        { sessionInfo }
      );
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `## Error: List Data View: ${dataViewID}\n\n**Unexpected Error**: ${error.message}\n\n${sessionInfo ? `**Session**: ${sessionInfo.sessionId} (${sessionInfo.authMode} mode)\n` : ''}*Error occurred at: ${new Date().toISOString()}*`
        }]
      };
    }
  }
}

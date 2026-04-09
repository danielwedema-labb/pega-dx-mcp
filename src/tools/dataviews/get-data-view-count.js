import { z } from 'zod';
import { BaseTool } from '../../registry/base-tool.js';
import { getSessionCredentialsSchema } from '../../utils/tool-schema.js';

export class GetDataViewCountTool extends BaseTool {
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
      name: 'get_data_view_count',
      description: `Retrieve the total count of results for a specified data view query without fetching the actual data. This is useful for pagination planning, understanding dataset sizes, and performance optimization before executing full data retrieval operations.

Supports the same comprehensive query capabilities as get_list_data_view:

1. **Simple Count**: Get total count of all records in a data view
   Example: { "dataViewID": "D_Employees" }

2. **Count with Parameters**: Count records with data view parameters for parameterized data views
   Example: { "dataViewID": "D_CustomerOrders", "dataViewParameters": { "CustomerID": "C-123", "Status": "Active" } }

3. **Filtered Count**: Count records matching specific filter criteria
   Example: { "dataViewID": "D_Employees", "query": { "filter": { "filterConditions": { "F1": { "lhs": {"field": "Department"}, "comparator": "EQ", "rhs": {"value": "IT"} } }, "logic": "F1" } } }

4. **Distinct Count**: Count unique combinations of selected fields
   Example: { "dataViewID": "D_Employees", "query": { "select": [{"field": "Department"}], "distinctResultsOnly": true } }

5. **Aggregated Count**: Count records with aggregation grouping
   Example: { "dataViewID": "D_Sales", "query": { "aggregations": { "TotalRevenue": { "field": "Revenue", "summaryFunction": "SUM" } }, "select": [{"aggregation": "TotalRevenue"}] } }

Filter comparators supported: boolean (IS_TRUE, IS_FALSE, IS_NULL, IS_NOT_NULL, EQ, NEQ), string (EQ, NEQ, IN, NOT_IN, IS_NULL, IS_NOT_NULL, STARTS_WITH, NOT_STARTS_WITH, ENDS_WITH, NOT_ENDS_WITH, CONTAINS, NOT_CONTAINS), number/date (EQ, NEQ, IN, NOT_IN, GT, GTE, LT, LTE, ISNULL, ISNOTNULL).

Aggregation functions: COUNT, MAX, MIN, DISTINCT_COUNT. For numbers: SUM, AVG.

Calculation functions: YEARS, QUARTERS, MONTHS, WEEKS, DAYS, HOURS, MONTHS_OF_YEAR, DAYS_OF_MONTH, DAYS_OF_WEEK, INTERVAL_GROUPING_FLOOR, INTERVAL_GROUPING_CEILING.

Note: Maximum result count is 5000 for queryable data views. The hasMoreResults field indicates if there are additional results beyond the count limit.`,
      inputSchema: z.object({
        dataViewID: z.string().describe('Data view ID. Example: "D_CaseList"'),
        dataViewParameters: z.looseObject({}).optional().describe('Parameters for parameterized data views. Key-value pairs. Example: {"CustomerID": "C-123"}'),
        query: z.looseObject({}).optional().describe('Optional query configuration for filtering, aggregation, and field selection. Uses the same structure as get_list_data_view for consistency.'),
        paging: z.looseObject({}).optional().describe('Optional pagination configuration that affects count calculation. Can specify either maxResultsToFetch or pageNumber/pageSize combination, but not both.'),
        sessionCredentials: getSessionCredentialsSchema().optional()
      })
    };
  }

  /**
   * Execute the get data view count operation
   */
  async execute(params) {
    const { dataViewID, dataViewParameters, query, paging } = params;
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

      // Execute with standardized error handling
      return await this.executeWithErrorHandling(
        `Data View Count: ${dataViewID}${query ? ' (with query)' : ''}${paging ? ' (with paging)' : ''}`,
        async () => await this.pegaClient.getDataViewCount(dataViewID, requestBody),
        { sessionInfo }
      );
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `## Error: Data View Count: ${dataViewID}\n\n**Unexpected Error**: ${error.message}\n\n${sessionInfo ? `**Session**: ${sessionInfo.sessionId} (${sessionInfo.authMode} mode)\n` : ''}*Error occurred at: ${new Date().toISOString()}*`
        }]
      };
    }
  }
}

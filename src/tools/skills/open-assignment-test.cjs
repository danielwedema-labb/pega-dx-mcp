const tools = require('./open-assignment.js');
const data = require('./dx-api-response.json');

const tool = new tools.OpenAssignmentTool();
const markdown = tool.formatSuccessResponse('Test Operation', data);
console.log(markdown);
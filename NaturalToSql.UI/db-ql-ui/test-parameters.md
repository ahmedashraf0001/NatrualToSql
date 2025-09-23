# Parameter Passing Test

## Test Steps:

1. Open the application at http://127.0.0.1:5174
2. Enable "Write Mode" by clicking the Write Mode button
3. Enter a natural language query that requires parameters, such as:
   - "change the names of the categories that its name is called electronics to smartphones"
   - "update products set price to 100 where name is iPhone"
   - "delete users where status is inactive"

## Expected Behavior:

### Before Fix:
- Parameters would be `null` in the execution request
- UPDATE/DELETE queries with parameters would fail

### After Fix:
- Parameters from the conversion response should be properly extracted and transformed
- Parameters should be passed as a Record<string, any> to the execution API
- Array format: `[{name: "@param1", value: "smartphones", source_text: "smartphones"}]`
- Should transform to: `{param1: "smartphones"}`

## Implementation Details:

1. **Storage**: `queryParameters` state stores the raw parameters from conversion response
2. **Transformation**: In `executeQuery`, parameters are transformed from array to Record format
3. **Parameter Name Handling**: The @ prefix is removed from parameter names
4. **Clearing**: Parameters are cleared when:
   - User manually edits SQL
   - Clear button is clicked
   - Loading from history
   - New query is generated

## Test Query:

Natural Language: "change the names of the categories that its name is called electronics to smartphones"

Expected Conversion Response:
```json
{
  "sql": "UPDATE C SET Name = @param1 FROM Categories C WHERE C.Name = @param2;",
  "parameters": [
    {
      "name": "@param1",
      "value": "smartphones",
      "source_text": "smartphones"
    },
    {
      "name": "@param2", 
      "value": "electronics",
      "source_text": "electronics"
    }
  ]
}
```

Expected Execution Request:
```json
{
  "profileId": "7576e9c9-83e8-40d8-8fbb-a886504d2b61",
  "sql": "UPDATE C SET Name = @param1 FROM Categories C WHERE C.Name = @param2;",
  "userQuery": "change the names of the categories that its name is called electronics to smartphones",
  "parameters": {
    "param1": "smartphones",
    "param2": "electronics"
  },
  "mode": "Write"
}
```

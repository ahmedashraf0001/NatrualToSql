# NaturalToSql

# NaturalToQuery.Api Endpoints

## Main Url: `https://localhost:7202, http://localhost:5000`

## Health Check

**URL:** `GET /api/health`

**Request:**  
No request body.

**Response:**
```json
{
  "status": "Healthy",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Available Servers

**URL:** `GET /api/setup/servers/{type}`

**Request:**  
No request body.  
**Path Parameter:**  
- `type`: Provider type (see enum below)

**ProviderType Enum:**
```csharp
// NaturalToQuery.Core.Contributers.Entities.ProviderType
public enum ProviderType {
    SqlServer //, Postgres, MySql, Sqlite, Other
}
```

**Response:**
```json
[
  {
    "name": "DESKTOP-QCK8UI5\\SQLEXPRESS",
    "databases": ["master", "ProductInventory"]
  }
]
```

---

## Available Databases

**URL:** `GET /api/setup/databases/{type}/{serverName}`

**Request:**  
No request body.  
**Path Parameters:**  
- `type`: Provider type (see enum above)  
- `serverName`: Server name

**Response:**
```json
[
  {
    "name": "master"
  },
  {
    "name": "ProductInventory"
  }
]
```

---

## Create Profile

**URL:** `POST /api/setup/profile`

**Request:**
```json
{
  "connectionType": "AutoConnect",
  "providerType": "SqlServer",
  "serverName": "DESKTOP-QCK8UI5\\SQLEXPRESS",
  "databaseName": "ProductInventory",
  "connectionString": "Server=DESKTOP-QCK8UI5\\SQLEXPRESS;Database=ProductInventory;Trusted_Connection=True;"
}
```

**ConnectionType Enum:**
```csharp
// NaturalToQuery.SharedKernal.DTOs.UI.ConnectionType
public enum ConnectionType {
    AutoConnect,
    ConnectionString
}
```

**ProviderType Enum:**
```csharp
// NaturalToQuery.Core.Contributers.Entities.ProviderType
public enum ProviderType {
    SqlServer //, Postgres, MySql, Sqlite, Other
}
```

**Response:**
```json
{
  "profileId": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "success": true
}
```

---

## Remove Profile

**URL:** `DELETE /api/setup/profile/{id}`

**Request:**  
No request body.  
**Path Parameter:**  
- `id`: Profile ID

**Response:**
```json
{
  "message": "Profile 'd290f1ee-6c54-4b01-90e6-d701748f0851' was deleted successfully."
}
```

---

## Convert Natural Language to SQL

**URL:** `POST /api/query/{profileId}/convert`

**Request:**
```json
{
  "profileId": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "query": "Show all products with price above 100",
  "allowWriteOperations": false
}
```

**Response:**
```json
{
  "sql": "SELECT * FROM Products WHERE Price > 100",
  "parameters": {},
  "success": true
}
```

---

## Execute SQL Query

**URL:** `POST /api/query/{profileId}/execute`

**Request:**
```json
{
  "profileId": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "sql": "SELECT * FROM Products WHERE Price > @price",
  "userQuery": "Show all products with price above 100",
  "parameters": { "price": 100 },
  "mode": "ReadOnly"
}
```

**ExecutionMode Enum:**
```csharp
// NaturalToQuery.SharedKernal.DTOs.Providers.ExecutionMode
public enum ExecutionMode {
    ReadOnly,
    Write
}
```

**Response:**
```json
{
  "rows": [
    { "ProductId": 1, "Name": "Laptop", "Price": 1200 },
    { "ProductId": 2, "Name": "Phone", "Price": 800 }
  ],
  "success": true
}
```

---

## Get Databases for Profile

**URL:** `GET /api/query/{profileId}/databases`

**Request:**  
No request body.  
**Path Parameter:**  
- `profileId`: Profile ID

**Response:**
```json
[
  { "name": "master" },
  { "name": "ProductInventory" }
]
```

---

## Get Schema for Profile

**URL:** `GET /api/query/{profileId}/schema`

**Request:**  
No request body.  
**Path Parameter:**  
- `profileId`: Profile ID

**Response:**
```json
{
  "tables": [
    {
      "name": "Products",
      "columns": [
        { "name": "ProductId", "type": "int" },
        { "name": "Name", "type": "nvarchar" },
        { "name": "Price", "type": "decimal" }
      ]
    }
  ]
}
```

---

**Note:**  
- All endpoints support anonymous access unless otherwise specified.
- Replace example values with your actual data.

---

Let me know if you want more details or example values for specific endpoints!

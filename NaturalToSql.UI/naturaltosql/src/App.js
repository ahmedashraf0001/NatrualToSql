import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertCircle, CheckCircle, Database, Server, Table, Users, Search, Play, Copy, Download, Loader } from 'lucide-react';
import './App.css';

// API Configuration
const API_BASE_URL = 'https://localhost:7287'; // Adjust to your .NET backend URL

// API Service
const api = {
  getSupportedDatabases: () => axios.get(`${API_BASE_URL}/SUPPORTED_DBS`),
  autoDetectServers: () => axios.get(`${API_BASE_URL}/AUTO_DETECT_SERVERS`),
  autoDetectDatabases: (serverId) => axios.get(`${API_BASE_URL}/AUTO_DETECT_DATABASES?serverId=${serverId}`),
  validateConnectionString: (connectionString) => axios.get(`${API_BASE_URL}/CONNECTION_STRING_VALIDATE?connectionString=${encodeURIComponent(connectionString)}`),
  validateManualSchema: (schema) => axios.post(`${API_BASE_URL}/MANUAL_SCHEMA_VALIDATE`, schema),
  getSchema: (databaseId) => axios.get(`${API_BASE_URL}/SCHEMA?databaseId=${databaseId}`),
  confirmSchema: (selectedTables) => axios.post(`${API_BASE_URL}/CONFIRMATION`, selectedTables),
  convertToSql: (userQuery) => axios.get(`${API_BASE_URL}/LLM_PIPELINE?userQuery=${encodeURIComponent(userQuery)}`),
  executeQuery: (sql) => axios.post(`${API_BASE_URL}/EXECUTE`, { sql })
};

function App() {
  // Main application state
  const [currentScreen, setCurrentScreen] = useState('welcome');
  const [setupStep, setSetupStep] = useState(1);
  
  // Setup wizard state
  const [selectedDatabase, setSelectedDatabase] = useState('');
  const [connectionMethod, setConnectionMethod] = useState('');
  const [supportedDatabases, setSupportedDatabases] = useState([]);
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [databases, setDatabases] = useState([]);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState('');
  const [connectionString, setConnectionString] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('');
  const [manualSchema, setManualSchema] = useState('');
  const [schemaValidation, setSchemaValidation] = useState('');
  const [fullSchema, setFullSchema] = useState(null);
  const [selectedTables, setSelectedTables] = useState([]);
  
  // Main app state
  const [naturalLanguageQuery, setNaturalLanguageQuery] = useState('');
  const [generatedSql, setGeneratedSql] = useState('');
  const [queryMetadata, setQueryMetadata] = useState({});
  const [queryResults, setQueryResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [allowWrite, setAllowWrite] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', type: 'success' });

  // Load supported databases on mount
  useEffect(() => {
    loadSupportedDatabases();
  }, []);

  const showAlert = (message, type = 'success') => {
    setAlert({ show: true, message, type });
    setTimeout(() => setAlert({ show: false, message: '', type: 'success' }), 3000);
  };

  const loadSupportedDatabases = async () => {
    try {
      const response = await api.getSupportedDatabases();
      setSupportedDatabases(response.data);
    } catch (error) {
      console.error('Failed to load supported databases:', error);
      showAlert('Failed to load supported databases', 'error');
    }
  };

  const handleDatabaseSelection = (dbType) => {
    setSelectedDatabase(dbType);
  };

  const handleConnectionMethodSelection = (method) => {
    setConnectionMethod(method);
  };

  const handleServerSelection = async (server) => {
    setSelectedServer(server);
    try {
      setIsLoading(true);
      const response = await api.autoDetectDatabases(server.id);
      setDatabases(response.data);
    } catch (error) {
      console.error('Failed to load databases:', error);
      showAlert('Failed to load databases from server', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const testConnectionString = async () => {
    if (!connectionString.trim()) {
      showAlert('Please enter a connection string', 'error');
      return;
    }

    try {
      setIsLoading(true);
      setConnectionStatus('connecting');
      const response = await api.validateConnectionString(connectionString);
      
      if (response.data.success) {
        setConnectionStatus('connected');
        setDatabases(response.data.databases);
        showAlert('Connection successful!', 'success');
      } else {
        setConnectionStatus('failed');
        showAlert('Connection failed: ' + response.data.error, 'error');
      }
    } catch (error) {
      setConnectionStatus('failed');
      showAlert('Connection failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const validateManualSchema = async () => {
    if (!manualSchema.trim()) {
      setSchemaValidation('Please provide a schema definition');
      return;
    }

    try {
      const response = await api.validateManualSchema({ schema: manualSchema });
      
      if (response.data.valid) {
        setSchemaValidation('✅ Schema is valid!');
        setFullSchema(response.data.parsedSchema);
      } else {
        setSchemaValidation('❌ ' + response.data.error);
      }
    } catch (error) {
      setSchemaValidation('❌ Invalid schema format');
    }
  };

  const loadSampleSchema = () => {
    const sampleSchema = `{
  "tables": [
    {
      "name": "Employees",
      "columns": [
        {"name": "id", "type": "INT"},
        {"name": "name", "type": "TEXT"},
        {"name": "age", "type": "INT"},
        {"name": "department_id", "type": "INT"}
      ]
    },
    {
      "name": "Departments", 
      "columns": [
        {"name": "id", "type": "INT"},
        {"name": "name", "type": "TEXT"}
      ]
    }
  ]
}`;
    setManualSchema(sampleSchema);
  };

  const loadSchemaFromDatabase = async (databaseId) => {
    try {
      setIsLoading(true);
      const response = await api.getSchema(databaseId);
      setFullSchema(response.data);
      setSelectedDatabaseId(databaseId);
    } catch (error) {
      console.error('Failed to load schema:', error);
      showAlert('Failed to load database schema', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTableSelection = (tableName, selected) => {
    if (selected) {
      setSelectedTables([...selectedTables, tableName]);
    } else {
      setSelectedTables(selectedTables.filter(t => t !== tableName));
    }
  };

  const nextStep = async () => {
    // Validation logic for each step
    if (setupStep === 1 && !selectedDatabase) {
      showAlert('Please select a database type', 'error');
      return;
    }
    
    if (setupStep === 2 && !connectionMethod) {
      showAlert('Please select a connection method', 'error');
      return;
    }

    if (setupStep === 3) {
      if (connectionMethod === 'auto' && !selectedServer) {
        showAlert('Please select a server', 'error');
        return;
      }
      if (connectionMethod === 'connection' && connectionStatus !== 'connected') {
        showAlert('Please establish a valid connection first', 'error');
        return;
      }
      if (connectionMethod === 'manual' && !fullSchema) {
        showAlert('Please provide and validate a schema first', 'error');
        return;
      }
    }

    if (setupStep === 4 && !selectedDatabaseId && connectionMethod !== 'manual') {
      showAlert('Please select a database', 'error');
      return;
    }

    if (setupStep === 5 && selectedTables.length === 0) {
      showAlert('Please select at least one table', 'error');
      return;
    }

    if (setupStep < 5) {
      setSetupStep(setupStep + 1);
      
      // Load auto-detect servers when moving to step 3 with auto method
      if (setupStep === 2 && connectionMethod === 'auto') {
        try {
          setIsLoading(true);
          const response = await api.autoDetectServers();
          setServers(response.data);
        } catch (error) {
          showAlert('Failed to detect servers', 'error');
        } finally {
          setIsLoading(false);
        }
      }

      // Load schema when moving to step 5
      if (setupStep === 4 && connectionMethod !== 'manual') {
        await loadSchemaFromDatabase(selectedDatabaseId);
      }
    }
  };

  const previousStep = () => {
    if (setupStep > 1) {
      setSetupStep(setupStep - 1);
    }
  };

  const finishSetup = async () => {
    try {
      setIsLoading(true);
      const schemaToSave = {
        tables: fullSchema.tables.filter(table => selectedTables.includes(table.name))
      };
      
      await api.confirmSchema(schemaToSave);
      showAlert('Setup completed successfully!', 'success');
      setTimeout(() => setCurrentScreen('main'), 1500);
    } catch (error) {
      showAlert('Failed to save configuration', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const generateQuery = async () => {
    if (!naturalLanguageQuery.trim()) {
      showAlert('Please enter a query description', 'error');
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.convertToSql(naturalLanguageQuery);
      
      setGeneratedSql(response.data.query);
      setQueryMetadata({
        intent: response.data.intent,
        confidence: response.data.confidence,
        risk: response.data.risk,
        explanation: response.data.explanation
      });
      
      showAlert('Query generated successfully!', 'success');
    } catch (error) {
      showAlert('Failed to generate query', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const executeQuery = async () => {
    if (!generatedSql.trim()) {
      showAlert('No query to execute', 'error');
      return;
    }

    const isWriteOperation = /\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b/i.test(generatedSql);
    
    if (!allowWrite && isWriteOperation) {
      showAlert('Write operations are disabled. Enable "Allow write operations" to continue.', 'error');
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.executeQuery(generatedSql);
      setQueryResults(response.data);
      showAlert('Query executed successfully!', 'success');
    } catch (error) {
      showAlert('Query execution failed: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const copyQuery = () => {
    navigator.clipboard.writeText(generatedSql);
    showAlert('Query copied to clipboard!', 'success');
  };

  return (
    <div className="app">
      {/* Alert System */}
      {alert.show && (
        <div className={`alert alert-${alert.type}`}>
          {alert.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {alert.message}
        </div>
      )}

      {/* Navigation */}
      <div className="navigation">
        <button 
          className={`nav-btn ${currentScreen === 'welcome' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('welcome')}
        >
          1. Welcome
        </button>
        <button 
          className={`nav-btn ${currentScreen === 'setup' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('setup')}
        >
          2. Setup
        </button>
        <button 
          className={`nav-btn ${currentScreen === 'main' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('main')}
        >
          3. Query Builder
        </button>
      </div>

      <div className="container">
        {/* Welcome Screen */}
        {currentScreen === 'welcome' && (
          <div className="screen">
            <div className="screen-header">
              <h1 className="screen-title">Natural Language Query Converter</h1>
              <p className="screen-subtitle">Transform your natural language into precise database queries using AI</p>
            </div>
            <div className="screen-content welcome-content">
              <h2>Welcome to NLQ Converter</h2>
              <p>
                Say goodbye to complex SQL syntax. Simply describe what data you need in plain English, 
                and our AI will generate the perfect query for your database.
              </p>
              <div className="welcome-buttons">
                <button 
                  className="btn btn-primary"
                  onClick={() => setCurrentScreen('setup')}
                >
                  Get Started
                </button>
                <button className="btn btn-outline">
                  View Documentation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Setup Screen */}
        {currentScreen === 'setup' && (
          <div className="screen">
            <div className="screen-header">
              <h1 className="screen-title">Database Setup Wizard</h1>
              <p className="screen-subtitle">Configure your database connection</p>
            </div>
            <div className="screen-content">
              {/* Step Indicator */}
              <div className="step-indicator">
                {[1, 2, 3, 4, 5].map(step => (
                  <div 
                    key={step}
                    className={`step-dot ${
                      step === setupStep ? 'active' : 
                      step < setupStep ? 'completed' : ''
                    }`}
                  >
                    {step}
                  </div>
                ))}
              </div>

              {/* Step 1: Database Type */}
              {setupStep === 1 && (
                <div className="wizard-step">
                  <h3>Choose Your Database Type</h3>
                  <div className="db-grid">
                    {supportedDatabases.map(db => (
                      <div 
                        key={db.id}
                        className={`db-card ${selectedDatabase === db.id ? 'selected' : ''}`}
                        onClick={() => handleDatabaseSelection(db.id)}
                      >
                        <div className="db-icon">
                          <Database size={24} />
                        </div>
                        <h4>{db.name}</h4>
                        <p>{db.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Connection Method */}
              {setupStep === 2 && (
                <div className="wizard-step">
                  <h3>Choose Connection Method</h3>
                  <div className="connection-options">
                    <div 
                      className={`option-card ${connectionMethod === 'auto' ? 'selected' : ''}`}
                      onClick={() => handleConnectionMethodSelection('auto')}
                    >
                      <div className="option-icon">
                        <Server size={24} />
                      </div>
                      <div>
                        <h4>Auto-Detect Servers</h4>
                        <p>Automatically find database servers on your system</p>
                      </div>
                    </div>
                    <div 
                      className={`option-card ${connectionMethod === 'connection' ? 'selected' : ''}`}
                      onClick={() => handleConnectionMethodSelection('connection')}
                    >
                      <div className="option-icon">
                        <Database size={24} />
                      </div>
                      <div>
                        <h4>Connection String</h4>
                        <p>Provide a connection string to your database</p>
                      </div>
                    </div>
                    <div 
                      className={`option-card ${connectionMethod === 'manual' ? 'selected' : ''}`}
                      onClick={() => handleConnectionMethodSelection('manual')}
                    >
                      <div className="option-icon">
                        <Table size={24} />
                      </div>
                      <div>
                        <h4>Manual Schema</h4>
                        <p>Manually provide your database schema</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Connection Details */}
              {setupStep === 3 && (
                <div className="wizard-step">
                  {connectionMethod === 'auto' && (
                    <>
                      <h3>Detected Servers</h3>
                      {isLoading ? (
                        <div className="loading-container">
                          <Loader className="spinner" size={24} />
                          <p>Scanning for database servers...</p>
                        </div>
                      ) : (
                        <div className="server-list">
                          {servers.map(server => (
                            <div 
                              key={server.id}
                              className={`option-card ${selectedServer?.id === server.id ? 'selected' : ''}`}
                              onClick={() => handleServerSelection(server)}
                            >
                              <div className="option-icon">
                                <Server size={20} />
                              </div>
                              <div>
                                <h4>{server.name}</h4>
                                <p>{server.type} • {server.host}:{server.port} • {server.status}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {connectionMethod === 'connection' && (
                    <>
                      <h3>Database Connection</h3>
                      <div className="form-group">
                        <label className="form-label">Connection String</label>
                        <input 
                          type="text"
                          className="form-input"
                          value={connectionString}
                          onChange={(e) => setConnectionString(e.target.value)}
                          placeholder="Server=localhost;Database=mydb;User Id=user;Password=***;"
                        />
                      </div>
                      <button 
                        className="btn btn-secondary"
                        onClick={testConnectionString}
                        disabled={isLoading}
                      >
                        {isLoading ? <Loader className="spinner" size={16} /> : null}
                        Test Connection
                      </button>
                      {connectionStatus && (
                        <div className={`connection-status status-${connectionStatus}`}>
                          <div className="status-dot"></div>
                          <span>
                            {connectionStatus === 'connecting' ? 'Testing connection...' :
                             connectionStatus === 'connected' ? 'Connected successfully!' :
                             'Connection failed'}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {connectionMethod === 'manual' && (
                    <>
                      <h3>Manual Schema Definition</h3>
                      <div className="form-group">
                        <label className="form-label">Schema (JSON Format)</label>
                        <textarea 
                          className="form-input textarea"
                          value={manualSchema}
                          onChange={(e) => setManualSchema(e.target.value)}
                          placeholder="Paste your schema definition here..."
                          rows="10"
                        />
                      </div>
                      <div className="schema-actions">
                        <button className="btn btn-outline" onClick={loadSampleSchema}>
                          Load Sample Schema
                        </button>
                        <button className="btn btn-secondary" onClick={validateManualSchema}>
                          Validate Schema
                        </button>
                      </div>
                      {schemaValidation && (
                        <div className={`schema-validation ${schemaValidation.includes('✅') ? 'success' : 'error'}`}>
                          {schemaValidation}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Step 4: Database Selection */}
              {setupStep === 4 && connectionMethod !== 'manual' && (
                <div className="wizard-step">
                  <h3>Select Database</h3>
                  <div className="database-list">
                    {databases.map(database => (
                      <div 
                        key={database.id}
                        className={`option-card ${selectedDatabaseId === database.id ? 'selected' : ''}`}
                        onClick={() => setSelectedDatabaseId(database.id)}
                      >
                        <div className="option-icon">
                          <Database size={20} />
                        </div>
                        <div>
                          <h4>{database.name}</h4>
                          <p>{database.tableCount} tables • {database.size}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 5: Table Selection */}
              {setupStep === 5 && (
                <div className="wizard-step">
                  <h3>Select Relevant Tables</h3>
                  <p className="step-description">
                    Choose which tables are most relevant for your queries to improve AI accuracy
                  </p>
                  {fullSchema && (
                    <div className="table-selection">
                      {fullSchema.tables.map(table => (
                        <div key={table.name} className="table-item">
                          <label className="table-checkbox">
                            <input 
                              type="checkbox"
                              checked={selectedTables.includes(table.name)}
                              onChange={(e) => handleTableSelection(table.name, e.target.checked)}
                            />
                            <div className="table-info">
                              <div className="table-name">
                                <Table size={16} />
                                {table.name}
                              </div>
                              <div className="table-columns">
                                {table.columns.map(col => col.name).join(', ')}
                              </div>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Controls */}
              <div className="wizard-controls">
                {setupStep > 1 && (
                  <button className="btn btn-secondary" onClick={previousStep}>
                    ← Previous
                  </button>
                )}
                <div className="flex-spacer"></div>
                {setupStep < 5 ? (
                  <button className="btn btn-primary" onClick={nextStep}>
                    Next →
                  </button>
                ) : (
                  <button 
                    className="btn btn-primary" 
                    onClick={finishSetup}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader className="spinner" size={16} /> : null}
                    Finish Setup
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Application Screen */}
        {currentScreen === 'main' && (
          <div className="screen">
            <div className="screen-header">
              <h1 className="screen-title">Query Builder</h1>
              <p className="screen-subtitle">Describe what data you need in natural language</p>
            </div>
            
            <div className="main-layout">
              {/* Sidebar */}
              <div className="sidebar">
                <div className="sidebar-section">
                  <h3 className="sidebar-title">Schema Explorer</h3>
                  {fullSchema && fullSchema.tables
                    .filter(table => selectedTables.includes(table.name))
                    .map(table => (
                    <div key={table.name} className="schema-tree">
                      <div className="schema-table">
                        <Table size={14} />
                        {table.name}
                      </div>
                      {table.columns.map(column => (
                        <div key={column.name} className="schema-column">
                          • {column.name} ({column.type})
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Main Content */}
              <div className="main-content">
                {/* Query Input */}
                <div className="query-section">
                  <div className="section-header">
                    <h3>Natural Language Query</h3>
                  </div>
                  <textarea 
                    className="nl-input"
                    value={naturalLanguageQuery}
                    onChange={(e) => setNaturalLanguageQuery(e.target.value)}
                    placeholder="Describe what data you need...

Examples:
• Show me all users who registered last month
• Find the top 10 products by sales
• List orders with customer details from last week"
                  />
                  <div className="query-controls">
                    <button 
                      className="btn btn-primary"
                      onClick={generateQuery}
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader className="spinner" size={16} /> : <Search size={16} />}
                      Generate Query
                    </button>
                    <label className="checkbox-label">
                      <input 
                        type="checkbox"
                        checked={allowWrite}
                        onChange={(e) => setAllowWrite(e.target.checked)}
                      />
                      Allow write operations
                    </label>
                  </div>
                </div>

                {/* Generated SQL */}
                {generatedSql && (
                  <div className="sql-section">
                    <div className="section-header">
                      <h3>Generated SQL Query</h3>
                      <div className="section-actions">
                        <button 
                          className="btn btn-outline"
                          onClick={() => setShowExplanation(!showExplanation)}
                        >
                          💡 Explain
                        </button>
                        <button className="btn btn-outline" onClick={copyQuery}>
                          <Copy size={16} />
                          Copy
                        </button>
                      </div>
                    </div>
                    <textarea 
                      className="sql-editor"
                      value={generatedSql}
                      onChange={(e) => setGeneratedSql(e.target.value)}
                    />
                    
                    {queryMetadata.confidence && (
                      <div className="query-metadata">
                        <div className="metadata-item">
                          <span className="metadata-label">Intent</span>
                          <span className="metadata-value">{queryMetadata.intent}</span>
                        </div>
                        <div className="metadata-item">
                          <span className="metadata-label">Confidence</span>
                          <span className={`metadata-value confidence-${queryMetadata.confidence > 0.8 ? 'high' : queryMetadata.confidence > 0.6 ? 'medium' : 'low'}`}>
                            {Math.round(queryMetadata.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    )}

                    {showExplanation && queryMetadata.explanation && (
                      <div className="explanation-panel">
                        <strong>💡 Explanation:</strong> {queryMetadata.explanation}
                      </div>
                    )}

                    <div className="sql-actions">
                      <button 
                        className="btn btn-primary"
                        onClick={executeQuery}
                        disabled={isLoading}
                      >
                        {isLoading ? <Loader className="spinner" size={16} /> : <Play size={16} />}
                        Execute Query
                      </button>
                    </div>
                  </div>
                )}

                {/* Query Results */}
                {queryResults && (
                  <div className="results-section">
                    <div className="section-header">
                      <h3>Query Results</h3>
                      <div className="results-info">
                        <span>{queryResults.rowCount} rows • {queryResults.executionTime}ms</span>
                        <button className="btn btn-outline">
                          <Download size={16} />
                          Export CSV
                        </button>
                      </div>
                    </div>
                    <div className="table-container">
                      <table className="results-table">
                        <thead>
                          <tr>
                            {queryResults.columns.map(column => (
                              <th key={column}>{column}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResults.rows.map((row, index) => (
                            <tr key={index}>
                              {queryResults.columns.map(column => (
                                <td key={column}>{row[column]}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
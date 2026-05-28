/*
  Alshaya AI Recruit - Azure infrastructure (Bicep)

  Provisions:
    - Log Analytics workspace + Application Insights
    - Key Vault (RBAC, secrets stored centrally)
    - Storage Account with a "resumes" Blob container (private)
    - PostgreSQL Flexible Server + database
    - Service Bus namespace + scoring queue
    - App Service Plan (Linux) + Web App for Containers
    - Front Door Standard with custom domain + WAF
  All wired with system-assigned managed identity (zero static secrets in App settings).
*/

@description('Base name prefix for all resources, e.g. alsh-recruit-prod.')
param namePrefix string

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Environment tag value (dev | stage | prod).')
@allowed([
  'dev'
  'stage'
  'prod'
])
param environment string = 'dev'

@description('Container image reference, e.g. myacr.azurecr.io/recruit:1.0.0.')
param containerImage string

@description('Postgres administrator login.')
param postgresAdminLogin string

@description('Postgres administrator password (mark as @secure when passing).')
@secure()
param postgresAdminPassword string

@description('AUTH_SECRET for signing JWT cookies (32+ chars, hex).')
@secure()
param authSecret string

@description('Google Gemini API key (optional - leave empty to disable provider).')
@secure()
param geminiApiKey string = ''

@description('Tavily API key for live research (optional).')
@secure()
param tavilyApiKey string = ''

@description('Azure OpenAI API key (optional).')
@secure()
param azureOpenAiApiKey string = ''

@description('Azure OpenAI endpoint URL (optional).')
param azureOpenAiEndpoint string = ''

@description('Azure OpenAI deployment name (optional).')
param azureOpenAiDeployment string = ''

@description('Public custom domain to attach to Front Door (optional).')
param customDomainName string = ''

var tags = {
  app: 'alshaya-ai-recruit'
  env: environment
  ownedBy: 'Talent Acquisition Platform Team'
}

// ---------------- Observability ----------------
resource logs 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${namePrefix}-logs'
  location: location
  tags: tags
  properties: {
    retentionInDays: 30
    sku: { name: 'PerGB2018' }
  }
}

resource appi 'Microsoft.Insights/components@2020-02-02' = {
  name: '${namePrefix}-appi'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logs.id
    IngestionMode: 'LogAnalytics'
  }
}

// ---------------- Key Vault ----------------
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${namePrefix}-kv'
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    publicNetworkAccess: 'Enabled'
  }
}

resource kvAuthSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'AUTH-SECRET'
  properties: { value: authSecret }
}

resource kvPgPassword 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'POSTGRES-ADMIN-PASSWORD'
  properties: { value: postgresAdminPassword }
}

resource kvGemini 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(geminiApiKey)) {
  parent: kv
  name: 'GOOGLE-GEMINI-API-KEY'
  properties: { value: geminiApiKey }
}

resource kvAzureOpenAi 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(azureOpenAiApiKey)) {
  parent: kv
  name: 'AZURE-OPENAI-API-KEY'
  properties: { value: azureOpenAiApiKey }
}

resource kvTavily 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(tavilyApiKey)) {
  parent: kv
  name: 'TAVILY-API-KEY'
  properties: { value: tavilyApiKey }
}

// ---------------- Storage ----------------
resource stg 'Microsoft.Storage/storageAccounts@2023-04-01' = {
  name: toLower(replace('${namePrefix}stg', '-', ''))
  location: location
  tags: tags
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    encryption: {
      services: { blob: { enabled: true } }
      keySource: 'Microsoft.Storage'
    }
  }
}

resource blobSvc 'Microsoft.Storage/storageAccounts/blobServices@2023-04-01' = {
  parent: stg
  name: 'default'
  properties: {
    cors: { corsRules: [] }
    deleteRetentionPolicy: { enabled: true, days: 30 }
  }
}

resource resumesContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-04-01' = {
  parent: blobSvc
  name: 'resumes'
  properties: { publicAccess: 'None' }
}

// ---------------- Postgres ----------------
resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: '${namePrefix}-pg'
  location: location
  tags: tags
  sku: { name: 'Standard_B2s', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: { storageSizeGB: 32 }
    backup: { backupRetentionDays: 14, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    network: { publicNetworkAccess: 'Enabled' }
  }
}

resource pgFw 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: pg
  name: 'AllowAllAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource pgDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: pg
  name: 'recruit'
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

// ---------------- Service Bus ----------------
resource sb 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: '${namePrefix}-sb'
  location: location
  tags: tags
  sku: { name: 'Standard', tier: 'Standard' }
}

resource sbQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: sb
  name: 'scoring-jobs'
  properties: {
    lockDuration: 'PT1M'
    maxDeliveryCount: 5
    enablePartitioning: false
    deadLetteringOnMessageExpiration: true
  }
}

// ---------------- App Service ----------------
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${namePrefix}-plan'
  location: location
  tags: tags
  sku: { name: 'P1v3', tier: 'PremiumV3' }
  kind: 'linux'
  properties: { reserved: true }
}

resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: '${namePrefix}-app'
  location: location
  tags: tags
  kind: 'app,linux,container'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${containerImage}'
      alwaysOn: true
      http20Enabled: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      healthCheckPath: '/api/system/status'
      appSettings: [
        { name: 'NODE_ENV', value: 'production' }
        { name: 'PORT', value: '3000' }
        { name: 'WEBSITES_PORT', value: '3000' }
        { name: 'DATABASE_PROVIDER', value: 'postgresql' }
        { name: 'DATABASE_URL', value: 'postgresql://${postgresAdminLogin}:${postgresAdminPassword}@${pg.properties.fullyQualifiedDomainName}:5432/recruit?sslmode=require' }
        { name: 'STORAGE_PROVIDER', value: 'azure-blob' }
        { name: 'AZURE_BLOB_CONTAINER', value: 'resumes' }
        { name: 'AZURE_STORAGE_ACCOUNT', value: stg.name }
        { name: 'QUEUE_PROVIDER', value: 'service-bus' }
        { name: 'AZURE_SERVICE_BUS_QUEUE', value: 'scoring-jobs' }
        { name: 'AUTH_PROVIDER', value: 'entra' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appi.properties.ConnectionString }
        { name: 'AUTH_SECRET', value: '@Microsoft.KeyVault(SecretUri=${kv.properties.vaultUri}secrets/AUTH-SECRET/)' }
        { name: 'GOOGLE_GEMINI_API_KEY', value: empty(geminiApiKey) ? '' : '@Microsoft.KeyVault(SecretUri=${kv.properties.vaultUri}secrets/GOOGLE-GEMINI-API-KEY/)' }
        { name: 'GOOGLE_GEMINI_MODEL', value: 'gemini-2.5-flash' }
        { name: 'AZURE_OPENAI_API_KEY', value: empty(azureOpenAiApiKey) ? '' : '@Microsoft.KeyVault(SecretUri=${kv.properties.vaultUri}secrets/AZURE-OPENAI-API-KEY/)' }
        { name: 'AZURE_OPENAI_ENDPOINT', value: azureOpenAiEndpoint }
        { name: 'AZURE_OPENAI_DEPLOYMENT', value: azureOpenAiDeployment }
        { name: 'TAVILY_API_KEY', value: empty(tavilyApiKey) ? '' : '@Microsoft.KeyVault(SecretUri=${kv.properties.vaultUri}secrets/TAVILY-API-KEY/)' }
      ]
    }
  }
}

// Grant the App Service managed identity Storage Blob Data Contributor on the storage account.
resource appBlobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(stg.id, app.id, 'blob-contributor')
  scope: stg
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Grant the App Service managed identity Key Vault Secrets User.
resource appKvRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, app.id, 'kv-secrets-user')
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Grant Service Bus Data Sender/Receiver on the namespace.
resource appSbSender 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(sb.id, app.id, 'sb-sender')
  scope: sb
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39')
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource appSbReceiver 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(sb.id, app.id, 'sb-receiver')
  scope: sb
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0')
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ---------------- Front Door + WAF ----------------
resource fdProfile 'Microsoft.Cdn/profiles@2023-07-01-preview' = {
  name: '${namePrefix}-fd'
  location: 'global'
  tags: tags
  sku: { name: 'Standard_AzureFrontDoor' }
}

resource fdEndpoint 'Microsoft.Cdn/profiles/afdEndpoints@2023-07-01-preview' = {
  parent: fdProfile
  name: '${namePrefix}-edge'
  location: 'global'
  properties: { enabledState: 'Enabled' }
}

resource fdOriginGroup 'Microsoft.Cdn/profiles/originGroups@2023-07-01-preview' = {
  parent: fdProfile
  name: 'app-origin-group'
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/api/system/status'
      probeRequestType: 'GET'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 60
    }
  }
}

resource fdOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2023-07-01-preview' = {
  parent: fdOriginGroup
  name: 'app-origin'
  properties: {
    hostName: app.properties.defaultHostName
    httpPort: 80
    httpsPort: 443
    originHostHeader: app.properties.defaultHostName
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
  }
}

resource fdRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-07-01-preview' = {
  parent: fdEndpoint
  name: 'default-route'
  dependsOn: [
    fdOrigin
  ]
  properties: {
    originGroup: { id: fdOriginGroup.id }
    supportedProtocols: [ 'Https' ]
    patternsToMatch: [ '/*' ]
    forwardingProtocol: 'HttpsOnly'
    httpsRedirect: 'Enabled'
    linkToDefaultDomain: 'Enabled'
    customDomains: []
  }
}

output appHostName string = app.properties.defaultHostName
output frontDoorEndpoint string = fdEndpoint.properties.hostName
output keyVaultUri string = kv.properties.vaultUri
output postgresHost string = pg.properties.fullyQualifiedDomainName
output storageAccount string = stg.name
output appInsightsConnectionString string = appi.properties.ConnectionString
output customDomainHint string = customDomainName

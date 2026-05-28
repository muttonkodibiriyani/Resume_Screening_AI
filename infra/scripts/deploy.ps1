# Deploy Alshaya AI Recruit to Azure (PowerShell variant).
# Usage:  .\deploy.ps1 -Env dev
#         .\deploy.ps1 -Env prod -Subscription "00000000-0000-0000-0000-000000000000"

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [ValidateSet('dev', 'stage', 'prod')] [string] $Env,
  [string] $Subscription = '',
  [string] $Location = 'uaenorth'
)

$ErrorActionPreference = 'Stop'

if (-not [string]::IsNullOrEmpty($Subscription)) {
  az account set --subscription $Subscription | Out-Null
}

$paramFile = "infra/azure/parameters.$Env.json"
if (-not (Test-Path $paramFile)) {
  throw "Missing parameter file: $paramFile"
}

$rg = "rg-alshaya-recruit-$Env"
if (-not (az group show --name $rg 2>$null)) {
  Write-Host "Creating resource group $rg in $Location ..."
  az group create --name $rg --location $Location --tags env=$Env app=alshaya-ai-recruit | Out-Null
}

$image = (Get-Content $paramFile -Raw | ConvertFrom-Json).parameters.containerImage.value
$acr   = ($image -split '\.')[0]

Write-Host "Logging into ACR $acr ..."
az acr login --name $acr | Out-Null

Write-Host "Building image $image ..."
docker build -f infra/Dockerfile -t $image --build-arg DATABASE_PROVIDER=postgresql .
docker push $image

Write-Host "Deploying Bicep to $rg ..."
az deployment group create `
  --resource-group $rg `
  --template-file infra/azure/main.bicep `
  --parameters "@$paramFile" `
  --parameters containerImage=$image | Out-Null

$endpoint = az deployment group show -g $rg -n main --query "properties.outputs.frontDoorEndpoint.value" -o tsv
Write-Host "Front Door endpoint: https://$endpoint"

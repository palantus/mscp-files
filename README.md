# mscp-files

## Sample setup.json
{
  "folders": {
    "MyData": "./data"
  }
}

## External file sources

When downloading files using ''/api/download'', it can request files from external sources using the file hash (md5). Enter the sources in ''setup.json'':

```
"externalFileSources": [
  "https://drop.mydomain.com/api/download/$hash$"
  {
    "exists": "https://drop.mydomain.com/api/exists/download/$hash$"
    "download": "https://drop.mydomain.com/api/download/$hash$"
  }
]
```

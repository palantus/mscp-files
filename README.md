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
    "exists": "https://drop.mydomain.com/api/exists/download/$hash$",
    "download": "https://drop.mydomain.com/api/download/$hash$",
    "file": "https://drop.mydomain.com/api/file/$hash$"
  }
]
```

## File types

External sites handling file extensions. Add to ''setup.json'':

```
"filetypes": [
  {
    "extensions": ["ld2"],
    "url": "https://mysite.com/apps/inspectfile/?hash=$hash$"
  }
]
```

The following variables are available:

  - $id$: Internal Id
  - $identifier$: The ''identifier'' property if filled. Otherwise internal Id.
  - $accesstoken$: The access token
  - $name$: The filename
  - $hash$: The md5 hash of the file
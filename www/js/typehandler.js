"use strict"

class TypeHandler{
  constructor(folderView){
    this.folderView = folderView
    this.types = entity.types

    this.typesSelectValues = ""
    this.typesSelectValuesNoFolder = ""
    for(let t in this.types){
      if(t != "folder")
        this.typesSelectValuesNoFolder += `<option value="${t}">${this.types[t].title}</option>\n`
      this.typesSelectValues += `<option value="${t}">${this.types[t].title}</option>\n`
    }
  }

  addNewTypeChanged(e){

  }

  async addNewExecute(e){
    let titleInput = e.parent().find("input[name=title]")
    await mscp.addFolder(this.folderView.folder.id, titleInput.val())
    titleInput.val("")
    this.folderView.refreshContent()
    e.parents(".toolbarbutton").removeClass("open")
    titleInput.val("")
  }

  /*
  async addExistingExecute(e){
    let typeInput = e.parent().find("select[name=type]")
    let titleInput = e.parent().find("input[name=title]")
    let identifierInput = e.parent().find("input[name=identifier]")
    await mscp.add(this.folderView.folder.id, typeInput.val(), titleInput.val(), identifierInput.val())
    this.folderView.refreshContent()
    e.parents(".toolbarbutton").removeClass("open")
    typeInput.val("folder")
    titleInput.val("")
    identifierInput.val("")
  }
  */

  getOpen(item){
    let type = this.types[item.properties.type]
    let open = type.open
    if(item.properties.ext){
      open = type.types.find(t => t.extensions && t.extensions.indexOf(item.properties.ext) >= 0).open || open
    }
    return open;
  }

  async openItem(item, e){
    e = e || {}
    let open = this.getOpen(item)

    switch(open.type){
      case "url":
        let url = await this.getShareableLink(item, true)

        if(open.dest === "window"){
          let width = open.windowWidth || 520
          let height = open.windowHeight || 570
          let left = Math.max(e.screenX - parseInt(width/2), 0)
          let top = Math.max(e.screenY - parseInt(height/2), 0)
          window.open(url, '_blank', `height=${height},width=${width},scrollbars=yes,status=no,left=${left},top=${top}`);
        } else
          window.open(url, '_blank');
        break;
    }
  }

  async getShareableLink(item, writeAccess, permanentAccess){
    let open = this.getOpen(item)
    switch(open.type){
      case "url":

        let accessToken = ""
        if(open.includeAccessToken)
          accessToken = await mscp.getEntityAccessToken(item.id, writeAccess, permanentAccess)

        let url = open.url
                    .replace("$id$", item.id)
                    .replace("$identifier$", item.properties.identifier || item.id)
                    .replace("$accesstoken$", accessToken)
                    .replace("$name$", item.properties.name)
                    .replace("$hash$", item.properties.hash)

        return url;
    }

    return ""
  }
}

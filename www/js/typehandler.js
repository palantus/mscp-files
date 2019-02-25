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
    let typeInput = e.parent().find("select[name=type]")
    let titleInput = e.parent().find("input[name=title]")
    await mscp.add(this.folderView.folder.id, typeInput.val(), titleInput.val())
    this.folderView.refreshContent()
    e.parents(".toolbarbutton").removeClass("open")
    typeInput.val("folder")
    titleInput.val("")
  }

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

  async openItem(item, e){
    e = e || {}
    let type = this.types[item.properties.type]
    switch(type.open.type){
      case "url":
        let url = await this.getShareableLink(item, true)

        if(type.open.dest === "window"){
          let width = type.open.windowWidth || 520
          let height = type.open.windowHeight || 570
          let left = Math.max(e.screenX - parseInt(width/2), 0)
          let top = Math.max(e.screenY - parseInt(height/2), 0)
          window.open(url, '_blank', `height=${height},width=${width},scrollbars=yes,status=no,left=${left},top=${top}`);
        } else
          window.open(url, '_blank');
        break;
    }
  }

  async getShareableLink(item, writeAccess, permanentAccess){
    let type = this.types[item.properties.type]
    switch(type.open.type){
      case "url":

        let accessToken = ""
        if(type.open.includeAccessToken)
          accessToken = await mscp.getEntityAccessToken(item.id, writeAccess, permanentAccess)

        let url = type.open.url
                    .replace("$id$", item.id)
                    .replace("$identifier$", item.properties.identifier || item.id)
                    .replace("$accesstoken$", accessToken)
                    .replace("$name$", item.properties.name)

        return url;
    }

    return ""
  }
}

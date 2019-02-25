"use strict"

class Entity{
  init(){
    this.nextId = 1
    this.views = {}

    $(document).keyup((e) => {
      if (e.keyCode == 27) { // escape key maps to keycode `27`
        $(".toolbarbutton").removeClass("open")
        $(".itemaction").removeClass("clicked")
      }
    });
    $("html").click((e)=>{
      if(e.target.nodeName == "HTML"){
        $(".folderview .foldercontent .folderitem.selected").removeClass("selected");
        $("div.itempropertiescontainer").hide();
      }
    })
  }

  async run(){
    await mscp.ready;

    $("#content").removeClass("hidden")
    this.types = {
      "folder": {
        title: "Folder",
        icon: "/mscp/libs/img/folder.png"
      },
      "file": {
        title: "File",
        icon: "/mscp/libs/img/document.png",
        open: {
          type: "url",
          dest: "window",
          url: "/api/raw/$id$/$name$",
          includeAccessToken: false,
          windowWidth: 700
        }
      }
    }
    this.addView(getUrlVar("folder") || "/")

    $("#loading").addClass("hidden")
  }

  addView(folderId){
    let id = `folderview${this.nextId}`
    this.nextId++

    let view = new FolderView(id)
    view.create()
    view.showFolder(folderId)

    this.views[id] = view
  }
}

class FolderView{
  constructor(elementId){
    this.elementId = elementId
    this.path = []
  }

  create(){
    this.typeHandler = new TypeHandler(this)

    let html = `
          <div class="folderview" id="${this.elementId}">
            <div class="toolbar">
              <button class="backbutton">Back</button>
              <span class="toolbarbutton">
                <button>New folder</button>
                <span class="newfoldercontainer dropdownmenu">
                  <input type="text" name="title" placeholder="Title"></input>
                  <div class="params"></div>
                  <button>Add</button>
                </span>
              </span>
              <span class="toolbarbutton">
                <button>Upload</button>
                <span class="uploadcontainer dropdownmenu">
                  <form class="fileupload">
                    <table>
                      <tr>
                        <td colspan="2" id="header">Upload file to folder</td>
                      </tr>
                      <tr>
                        <th>Select File: </th>
                        <td><input class="chosenfile" name="csv" type="file" multiple/></td>
                      </tr>
                      <tr>
                        <td colspan="2">
                          <input type="submit" value="Begin Upload!" id="uploadbutton"/>
                        </td>
                      </tr>
                    </table>
                  </form>
                </span>
              </span>
              <!--
              <span class="toolbarbutton">
                <button>Add existing</button>
                <span class="addexistingcontainer dropdownmenu">
                  <select name="type" value="folder" size="${Object.keys(this.typeHandler.types).length-1}">${this.typeHandler.typesSelectValuesNoFolder}</select>
                  <input type="text" name="identifier" placeholder="Identifier"></input>
                  <input type="text" name="title" placeholder="Title"></input>
                  <div class="params"></div>
                  <button>Add</button>
                </span>
              </span>
              -->

              <span class="folderpath"></span>
            </div>
            <div>
              <ul class="foldercontent">
              </ul>
              <div class="itempropertiescontainer"></div>
            </div>
          </div>`

    this.element = $(html)
    $("#content").append(this.element)
    this.element.find(".toolbarbutton > button").click((e) => {
      let isOpen = $(e.target).parent().is(".open")
      this.element.find(".toolbarbutton").removeClass("open")
      $(e.target).parent().toggleClass('open', !isOpen).find('select').focus().val('folder');
      e.stopPropagation();
    })
    this.element.find("button.backbutton").click((e) => this.back($(e.target)))
    this.element.find("span.newfoldercontainer input").keyup((e) => {if(e.keyCode == 13) this.element.find("span.newfoldercontainer button").click()})
    this.element.find("span.newfoldercontainer button").click((e) => this.typeHandler.addNewExecute($(e.target)))
    //this.element.find("span.uploadcontainer input").keyup((e) => {if(e.keyCode == 13) this.element.find("span.uploadcontainer button").click()})
    //this.element.find("span.uploadcontainer button").click((e) => this.typeHandler.uploadExecute($(e.target)))

    this.element.find("span.uploadcontainer .fileupload").submit((event) => {
      event.preventDefault();
      fileUploadClicked(this, this.element.find("span.uploadcontainer .fileupload")[0], this.element.find("span.uploadcontainer .fileupload .chosenfile")[0])
      return false;
    });

    //this.element.find("span.addexistingcontainer input").keyup((e) => {if(e.keyCode == 13) this.element.find("span.addexistingcontainer button").click()})
    //this.element.find("span.addexistingcontainer button").click((e) => this.typeHandler.addExistingExecute($(e.target)))

    this.propertiesHandler = new PropertiesHandler(this);
  }

  async showFolder(id){

    let folder = await mscp.folder(id);
    this.path.push(folder)
    this.element.find(".backbutton").prop("disabled",this.path.length == 1)
    this.element.find("span.folderpath").html(this.path.map((p) => p.title).join("/") || "/")

    await this.refreshContent(folder);
  }

  async refreshContent(newFolder){
    if(newFolder)
      this.folder = newFolder;
    else
      this.folder = await mscp.folder(this.folder.id);

    if(this.folder == null){
      alert("Unknown folder")
      return;
    }

    let container = this.element.find(".foldercontent")
    container.empty()

    FolderView.sortFolder(this.folder)

    for(let e of this.folder.content){
      let folderItem = $("<li/>", {class: "folderitem"})

      let title = e.properties.name || e.id

      if(!this.typeHandler.types[e.properties.type]){
        alert("Unknown entity type: " + e.properties.type)
        continue;
      }

      let icon = $("<img/>", {src: this.typeHandler.types[e.properties.type].icon || "/mscp/libs/img/help.png"})
      icon.click((e) => {this.itemClicked($(e.target).parent(), e); e.stopPropagation();});
      folderItem.append(icon)
      $("<span/>", {class: "itemname", html: title}).appendTo(folderItem).click((e) => {this.itemClicked($(e.target).parent(), e); e.stopPropagation();})
      folderItem.data("item", e)
      folderItem.click((e) => {
        if(!$(e.target).is(".folderitem"))
          return;

        let selected = $(e.currentTarget).is(".selected")
        $(e.currentTarget).parents(".foldercontent").find(".folderitem").removeClass("selected");
        $(e.currentTarget).toggleClass("selected", !selected)
        this.propertiesHandler.showProperties($(e.currentTarget).data("item"), !selected)
      })

      let itemActions = $(`<span class="itemactions"/>`)

      // DELETE BUTTON
      let deleteActionHTML = `<span class="itemaction" title="Remove">
                                <img src="/mscp/libs/img/delete.png"/>
                                <span class="confirm dropdownmenu">
                                  <div>Are you sure?</div>
                                  <span class="smallbutton ok">Yes</span>
                                  <span class="smallbutton cancel">No</span>
                                </span>
                              </<span>`

      let deleteAction = $(deleteActionHTML)
      deleteAction.find(".ok").click((e) => {this.itemDelete($(e.target).parents(".folderitem").data("item")); e.stopPropagation();})
      itemActions.append(deleteAction)

      // RENAME BUTTON
      /*
      let editActionHTML = `<span class="itemaction" title="Rename">
                                <img src="/mscp/libs/img/edit.ico"/>
                                <span class="dropdownmenu">
                                  <input name="title" placeholder="Title" value="${title}"/>
                                  <span class="smallbutton ok">Ok</span>
                                  <span class="smallbutton cancel">Cancel</span>
                                </span>
                              </<span>`

      let editAction = $(editActionHTML)
      editAction.find(".ok").click((e) => {this.itemRename($(e.target).parents(".folderitem").data("item"), $(e.target).parent().find("input[name=title]").val()); e.stopPropagation();})
      itemActions.append(editAction)

      // MOVE BUTTON
      let moveActionHTML = `<span class="itemaction" title="Move">
                                <img src="/mscp/libs/img/forward.png"/>
                                <span class="dropdownmenu">
                                  <button class="choosedest">Choose destination</button>
                                  <div><span>Destination: </span><span class="selecteddest">&lt;none&gt;</span><br/><br/>
                                  <span class="smallbutton ok">Ok</span>
                                  <span class="smallbutton cancel">Cancel</span>
                                </span>
                              </<span>`

      let moveAction = $(moveActionHTML)
      moveAction.find(".choosedest").click(async (e) => {
        try{
          let dest = await pickFolder(this, this.path);
          $(e.target).data("entityid", dest.id)
          $(e.target).parent().find("span.selecteddest").html(dest.properties.title)
        } catch(err){}
      })
      moveAction.find(".ok").click((e) => {
        this.itemMove($(e.target).parents(".folderitem").data("item"), $(e.target).parents(".itemaction").find("button.choosedest").data("entityid"));
        e.stopPropagation();
      })
      itemActions.append(moveAction)
      */


      // SHARE BUTTON
      if(this.typeHandler.types[e.properties.type].allowShare){
        let shareActionHTML = `<span class="itemaction" title="Share">
                                  <img src="/mscp/libs/img/share.png"/>
                                  <span class="confirm dropdownmenu">
                                    <label><input type="checkbox" name="writeaccess"/>Write access</label>
                                    <label><input type="checkbox" name="permanentaccess"/>Permanent access</label>
                                    <input style="display: none;" type="text" name="generatedlink"/>
                                    <span class="smallbutton generate">Generate</span>
                                    <span class="smallbutton cancel">Close</span>
                                  </span>
                                </<span>`

        let shareAction = $(shareActionHTML)
        shareAction.find(".generate").click(async (e) => {
          let writeAccess = $(e.target).parents(".folderitem").find("input[name=writeaccess]").is(":checked")
          let permanentAccess = $(e.target).parents(".folderitem").find("input[name=permanentaccess]").is(":checked")
          $(e.target).parents(".folderitem").find("input[name=generatedlink]").val(await this.itemShare($(e.target).parents(".folderitem").data("item"), writeAccess, permanentAccess)).show().focus().select();
          e.stopPropagation();
        })
        itemActions.append(shareAction)
      }

      folderItem.append(itemActions)
      container.append(folderItem)
    }

    container.find(".itemaction").click((e) => {
      if(!$(e.target).is("img"))
        return;
      let clicked = $(e.currentTarget).is(".clicked");
      $(".folderitem .itemaction").removeClass("clicked");
      $(e.currentTarget).toggleClass("clicked", !clicked);
      if(!clicked) {
        $(e.currentTarget).find("input:first").focus().select();
        $(e.currentTarget).find("input").keyup((e)=>{if(e.keyCode == 13) $(e.target).parents(".itemaction").find(".ok").click(); e.stopPropagation();});
      }
      e.stopPropagation();
    })
    container.find(".itemaction .cancel").click((e) => {$(e.target).parents(".itemaction").removeClass("clicked"); e.stopPropagation()})
  }

  static sortFolder(folder){
    folder.content = folder.content.sort((a, b) => {
      if(a.properties.type == "folder" && b.properties.type != "folder") return -1
      else if(a.properties.type != "folder" && b.properties.type == "folder") return 1
      else return a.properties.name.toLowerCase() > b.properties.name.toLowerCase() ? 1 : -1
    })
  }

  itemClicked(itemElement, e){
    let item = itemElement.data("item")

    if(item.properties.type == "folder"){
      this.showFolder(item.id)
    } else {
      this.typeHandler.openItem(item, e)
    }
  }

  back(){
    if(this.path.length <= 1)
      return;

    this.path.pop()
    this.showFolder(this.path.pop().id)
  }

  async itemDelete(item){
    await mscp.delete(item.id)
    this.refreshContent()
  }

  async itemRename(item, newName){
    await mscp.setProperty(item.id, "title", newName)
    this.refreshContent()
  }

  async itemShare(item, writeAccess, permanentAccess){
    return this.typeHandler.getShareableLink(item, writeAccess, permanentAccess)
  }

  async itemMove(item, destFolderId){
    await mscp.move(item.id, this.folder.id, destFolderId)
    this.refreshContent()
  }
}

var entity = new Entity();
entity.init();
$(() => entity.run());

function getUrlVar( name ){
    name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
    var regexS = "[\\?&]"+name+"=([^&#]*)";
    var regex = new RegExp( regexS );
    var results = regex.exec( window.location.href );
    if( results == null )
        return undefined;
    else
        return decodeURIComponent(results[1]);
}

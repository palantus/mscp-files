"use strict"

class FilePicker{

  constructor(folderView, allowFolders, allowFiles){
    this.folderView = folderView;
    this.allowFolders = allowFolders;
    this.allowFiles = allowFiles;
    this.path = Array.isArray(folderView.path) ? folderView.path : folderView.path ? [folderView.path] : [];
    this.path = JSON.parse(JSON.stringify(this.path))
  }

  async pickFile(){
    return new Promise(async (resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      $("#filepicker-ok").off("click");
      $("#filepicker-up").off("click");

      $("#filepicker").click((e) => {
        if($(e.target).is("#filepicker")) this.cancel()
      })
      $("#filepicker-ok").click(() => this.ok())
      $("#filepicker-cancel").click(() => this.cancel())
      $("#filepicker-up").click(() => this.up())

      $("#filepicker-ok").prop("disabled", !this.allowFolders);

      this.showFolder();
      $("#filepicker").removeClass("hidden");
    })
  }

  async showFolder(){
    $("#filepicker-up").prop("disabled", this.path.length <= 1)
    let folder = await mscp.folder(this.path.length > 0 ? this.path[this.path.length - 1].id : null);
    $("#filepicker-items").empty();

    let newContent = []
    for(let i = folder.content.length-1; i >= 0 ; i--){
      if(this.allowFiles && folder.content[i].properties.type !== "folder"){
        newContent.push(folder.content[i])
      } else if(folder.content[i].properties.type == "folder"){
        newContent.push(folder.content[i])
      }
    }
    folder.content = newContent;

    FolderView.sortFolder(folder)
    for(let e of folder.content){

      let folderItem = $("<li/>", {class: "folderitem"})
      let title = e.properties.title || e.id

      let icon = $("<img/>", {src: this.folderView.typeHandler.types[e.properties.type].icon || "/mscp/libs/img/help.png"})
      icon.click((e) => {
        this.itemClicked($(e.target).parent().data("item"));
        e.stopPropagation();
      });
      folderItem.append(icon)

      $("<span/>", {class: "itemname", html: title}).appendTo(folderItem).click((e) => {
        this.itemClicked($(e.target).parent().data("item"));
        e.stopPropagation();
      })
      folderItem.data("item", e)
      folderItem.click((e) => {
        if(!$(e.target).is(".folderitem"))
          return;

        let selected = !$(e.currentTarget).is(".selected")
        $(e.currentTarget).parents(".foldercontent").find(".folderitem").removeClass("selected");
        $(e.currentTarget).toggleClass("selected", selected)

        let item = $(e.target).data("item")
        if(item.properties.type == "folder" && this.allowFolders){
          $("#filepicker-ok").prop("disabled", false);
        }
        else if(selected){
          if(item && (item.properties.type === "folder" && this.allowFolders) || (item.properties.type !== "folder" && this.allowFiles)){
            $("#filepicker-ok").prop("disabled", false);
          } else {
            $("#filepicker-ok").prop("disabled", true);
          }
        } else {
          $("#filepicker-ok").prop("disabled", true);
        }
      })

      $("#filepicker-items").append(folderItem);
    }
  }

  async itemClicked(item){
    if(item.properties.type == "folder"){
      this.path.push(item);
      this.showFolder();
    } else {
      $("#filepicker").addClass("hidden");
      this.resolve(item)
    }
  }

  ok(){
    let item = $("#filepicker-items .folderitem.selected").data("item")
    if(item){
      this.resolve(item);
      $("#filepicker").addClass("hidden");
    } else if(this.allowFolders && this.path.length > 0){
      this.resolve(this.path[this.path.length - 1])
      $("#filepicker").addClass("hidden");
    }
  }

  cancel(){
    $("#filepicker").addClass("hidden");
  }

  up(){
    this.path.pop()
    this.showFolder();
  }
}

async function pickFile(folderView){
  return await new FilePicker(folderView, false, true).pickFile();
}

async function pickFolder(folderView, path){
  return await new FilePicker(folderView, true, false).pickFile();
}

async function pickAny(folderView, path){
  return await new FilePicker(folderView, true, true).pickFile();
}

"use strict"

class PropertiesHandler{
  constructor(folderView){
    this.folderView = folderView
    this.element = this.folderView.element.find("div.itempropertiescontainer")
    this.element.html(`
        <p class="header props">Properties</p>
        <table class="itemproperties"></table>
        <p class="header tags">Tags</p>
        <table class="itemtags"></table>
        <button>Add</button>
      `)
  }

  showProperties(item, show){
    if(show === false){
      this.element.hide()
      return;
    }

    this.element.show();
    let propsE = this.element.find(".itemproperties").empty()
    let tagsE = this.element.find(".itemtags").empty()

    for(let p in item.properties){
      propsE.append(`<tr>
                        <td>${p.replace(/([A-Z][a-z])/g, ' $1').replace(/^./, function(str){ return str.toUpperCase()})}</td>
                        <td>|</td>
                        <td>${item.properties[p]}</td>
                      `)
    }

    if(item.tags.length > 0){
      for(let t of item.tags){
        let row = $("<tr/>")
        let cell1 = $("<td/>", {html: t.replace(/([A-Z][a-z])/g, ' $1').replace(/^./, function(str){ return str.toUpperCase(); })})
        row.append(cell1).appendTo(tagsE)
      }
      this.element.find(".header.tags").show()
    } else {
      //this.element.find(".header.tags").hide()
    }
  }
}

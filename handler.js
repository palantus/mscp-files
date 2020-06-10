"use strict"

const guid = require("guid")
const moment = require("moment")
const fs = require("fs")
const path = require("path")
const md5File = require('md5-file/promise')
const md5 = require('md5')
const mime = require('mime-types')
const { resolve } = require('path');
const del = require('del');
const request = require("request-promise-native")
const Entity = require("entitystorage")

class Handler{

  async initFirst(){
    this.global.setup = await new Promise((r) => fs.readFile(path.join(__dirname, "setup.json"), "utf-8", (err, file) => r(JSON.parse(file))))

    if(!this.global.setup.baseurl)
      this.global.setup.baseurl = "http://localhost"

    await Entity.init("./database")

    this.reindex()
  }

  async reindex(){

    let id = md5("/")
    Entity.findOrCreate(`prop:id=${id}`)
          .prop("id", id)
          .prop("name", "root")
          .prop("path", "/")
          .prop("parentpath", "")
          .prop("type", "folder")
          .removeTag("deleted")

    let folders = this.global.setup.folders || {}
    for(let folderName in folders){
      let folder = path.resolve(folders[folderName])

      if (!fs.existsSync(folder)){
        fs.mkdirSync(folder);
      }

      await this.reindexFilesOfPath(folder)

      id = md5("/"+folderName)
      Entity.findOrCreate(`prop:id=${id}`)
            .prop("id", id)
            .prop("name", folderName)
            .prop("path", "/"+folderName)
            .prop("parentpath", "/")
            .prop("type", "folder")
            .removeTag("deleted")
      /*
      let files = await this.getAllFilesOfDir(folder)
      for(let file of files){
        //let id = await md5File(file)

        let parts = file.split("/")
        let curPath = `/${folderName}`
        let prevPath = curPath
        let curPathHash = md5(prevPath)
        let prevPathHash = curPathHash

        hashToPath[curPathHash] = curPath

        for(let i = rootFolderNumParts; i <= parts.length - 1; i++){
          curPath += "/" + parts[i]

          //console.log(`${i}, ${rootFolderNumParts}, ${file}, ${curPath}, ${parts[parts.length - 1]}`)

          curPathHash = md5(curPath)

          if(hashToPath[curPathHash] === undefined){
            if(i == parts.length - 1){
              if(hashToSubFiles[prevPathHash] === undefined)
                hashToSubFiles[prevPathHash] = []
              if(hashToSubFiles[prevPathHash].indexOf(curPathHash) < 0)
                hashToSubFiles[prevPathHash].push(curPathHash)
            } else {
              if(hashToSubFolders[prevPathHash] === undefined)
                hashToSubFolders[prevPathHash] = []
              if(hashToSubFolders[prevPathHash].indexOf(curPathHash) < 0)
                hashToSubFolders[prevPathHash].push(curPathHash)
            }

            hashToParentFolder[curPathHash] = prevPathHash
            hashToFilename[curPathHash] = parts[i]
            hashToPath[curPathHash] = curPath
          }

          prevPath = curPath
          prevPathHash = curPathHash
        }
      }
      */
    }

    this.fillMissingHashes();
  }

  async reindexFilesOfPath(pathToIndex){
    const { promisify } = require('util');
    const fs = require('fs');
    const readdir = promisify(fs.readdir);
    const rename = promisify(fs.rename);
    const stat = promisify(fs.stat);
    let vPathParent = this.realPathToVirtual(pathToIndex)

    const subdirs = await readdir(pathToIndex);
    for(let d of subdirs){
      let fullPath = resolve(pathToIndex, d)
      let isDir = (await stat(fullPath)).isDirectory()
      let vPath = this.realPathToVirtual(fullPath)
      let id = md5(vPath)
      let file = Entity.find(`prop:id=${id}`)

      if(isDir){
        this.reindexFilesOfPath(fullPath)

        if(!file){
          //TODO: Add folder metadata
        }
        //TODO: this code needs to only happen on unknown folders
        Entity.findOrCreate(`prop:id=${id}`)
              .prop("id", id)
              .prop("name", d)
              .prop("path", vPath)
              .prop("parentpath", vPathParent)
              .prop("type", "folder")
              .removeTag("deleted")
      } else {
        if(file){
          //TODO: check date, size etc.
          file.prop("ext", d.split(".").pop() || "")
              .removeTag("deleted")
        } else {
          Entity.findOrCreate(`prop:id=${id}`)
                .prop("id", id)
                .prop("name", d)
                .prop("path", vPath)
                .prop("parentpath", vPathParent)
                .prop("type", "file")
                .prop("hash", "")
                .prop("ext", d.split(".").pop() || "")
                .removeTag("deleted")
        }
      }
    }

    /*
    async function getFiles(dir) {
      const subdirs = await readdir(dir);
      const files = await Promise.all(subdirs.map(async (subdir) => {
        const res = resolve(dir, subdir);
        return (await stat(res)).isDirectory() ? getFiles(res) : res;
      }));
      return files.reduce((a, f) => a.concat(f), []);
    }

    return await getFiles(path)
    */
  }

  async fillMissingHashes(){
    console.log("Filling hashes")
    let file = Entity.find(`prop:type=file prop:hash= !tag:deleted`);
    while(file){
        if(!file.path){
          file.tag("deleted")
          continue;
        }
        let filename = this.virtualPathToReal(file.path);
        let exists = await new Promise(resolve => fs.stat(filename, (err, stat) => resolve(err == null ? true : false)))
        if(!exists){
          file.tag("deleted")
          continue;
        }

        let hash = await md5File(filename)
        if(hash) {
          file.prop("hash", hash)
          console.log(`Filled hash of file: ${file.path} with ${hash}`)
        } else {
          console.log(`Could not generate hash of file ${filename}. Hash generation aborted`)
          break;
        }

        file = Entity.find(`prop:type=file prop:hash= !tag:deleted`);
    }
  }

  async tryExternalFileSources(hash, operation){
    if(this.global.setup.externalFileSources){
      for(let source of this.global.setup.externalFileSources){
        if(!source[operation] || !source.exists){
          console.log(`External source missing ${operation} or exists url`)
          continue;
        }

        let options = {
          uri: source.exists.replace("$hash$", hash),
          headers: {
              'Origin': this.request.req.header("Origin")
          }
        }

        let response = await request(options)
        if(response){
          let res = JSON.parse(response);
          if(res.success == true && res.result == true){
            options.uri = source[operation].replace("$hash$", hash)
            let r = request(options)
            r.pipe(this.request.res)
            await r
            //this.request.res.redirect(source.download.replace("$hash$", hash))
            return true;
          }
        }
      }
    }
    return false;
  }

  async download(hash){
    let file = Entity.find(`(prop:"id=${hash}"|prop:"hash=${hash}") !tag:deleted`)

    if(file){
      let filename = this.virtualPathToReal(file.path);
      let isFile = await new Promise((r) => fs.lstat(filename, (err, stats) => r(stats.isFile(filename))))
      if(!isFile)
        throw `${hash} is a directory`

      return {name: file.name, path: filename}
    } else {
      let handled = await this.tryExternalFileSources(hash, "download")
      if(handled){
        return;
      }
    }
    throw "Unknown file"
  }

  async raw(hash){
    let file = Entity.find(`(prop:"id=${hash}"|prop:"hash=${hash}") !tag:deleted`)

    if(!file)
      throw "Unknown file"

    let filename = this.virtualPathToReal(file.path);
    let isFile = await new Promise((r) => fs.lstat(filename, (err, stats) => r(stats.isFile(filename))))
    if(!isFile)
      throw `${hash} is a directory`

    this.request.res.sendFile(filename)
  }

  async file(hash){
    let file = Entity.find(`(prop:"id=${hash}"|prop:"hash=${hash}") !tag:deleted`)

    if(file){
        return {filename: file.name, hash: hash}
    } else {
      let handled = await this.tryExternalFileSources(hash, "file")
      if(handled){
       return;
      }
    }
    throw "Unknown file"
  }

  async folder(hashOrPath){
    let folder = null;
    if(hashOrPath.length == 32 && hashOrPath.indexOf("/") < 0){ //hash
      folder = Entity.find("prop:id="+hashOrPath, true);
    } else {
      folder = Entity.find('prop:path=' + hashOrPath);
    }

    if(!folder)
      throw "Unknown folder: " + hashOrPath

    let folderContent = Entity.search("prop:parentpath=" + folder.path + " !tag:deleted")
    for(let i = folderContent.length - 1; i >= 0; i--){
      let filename = this.virtualPathToReal(folderContent[i].path);
      let exists = await new Promise(resolve => fs.stat(filename, (err, stat) => resolve(err == null ? true : false)))
      if(!exists){
        folderContent[i].tag("deleted")
        folderContent.splice(i, 1)
      }
    }

    return {
      name: folder.name,
      id: folder.id,
      parentPath: folder.parentpath,
      path: folder.path,
      content: folderContent.map(e => {return {id: e.id, tags: e.tags, properties: e.props, relations: e.rels}}),
      links: {
        parent: folder.parentpath ? `${this.global.setup.baseurl}/api/folder/?hash=${folder.parentpath}` : null,
        self: `${this.global.setup.baseurl}/api/folder/?path=${folder.path}`
      }
    }
  }

  async upload(folderIdOrPath){
    //console.log("Upload: " + folderIdOrPath)
    let folder = await this.folder(folderIdOrPath)
    let files = []
    let realPath = this.virtualPathToReal(folder.path)

    let folderExists = await new Promise((r) => fs.access(realPath, fs.constants.R_OK | fs.constants.W_OK, (err) => r(err?false:true)))

    if(!realPath || !folderExists)
      throw `The folder "${realPath}" doesn't exist`

    for(let filedef in this.request.req.files){
      let file = Array.isArray(this.request.req.files[filedef]) ? this.request.req.files[filedef] : [this.request.req.files[filedef]]
      for(let f of file){
        f.mv(realPath + "/" + f.name)
        files.push(this.realPathToVirtual(realPath + "/" + f.name))
      }
    }

    await this.reindexFilesOfPath(realPath);
    await this.fillMissingHashes();

    let ret = []
    for(let f of files){
      console.log(f)
      ret.push(await this.file(md5(f)))
    }

    return ret
  }

  async addFolder(path, name){
    let folder = await this.folder(path)
    let realPath = this.virtualPathToReal(folder.path)
    let folderExists = await new Promise((r) => fs.access(realPath, fs.constants.R_OK | fs.constants.W_OK, (err) => r(err?false:true)))
    if(!realPath || !folderExists)
      throw `The folder "${realPath}" doesn't exist`

    let newFullPath = resolve(realPath, name);

    console.log(`New folder: ${newFullPath}`)
    await new Promise((r) => fs.mkdir(newFullPath, (err) => r()))

    await this.reindex(); //TODO: nok for ineffektivt
    return true;
  }

  async delete(id){
    let file = Entity.find(`prop:id=${id}`)

    if(!file)
      throw "Unknown file/folder"

    await file.tag("deleted")
    let filename = this.virtualPathToReal(file.path);

    console.log("Deleting: " + filename)
    await del(filename, {force: true})
    return true;
  }

  async filetypes(){
    return this.global.setup.filetypes || []
  }

  virtualPathToReal(path){
    path = path.startsWith("/") ? path : "/" + path
    path = (path.endsWith("/") && path.length > 1) ? path.substring(0, path.length - 1) : path
    let rootName = path.split("/")[1]

    if(this.global.setup.folders[rootName] !== undefined){
      let remainingPath = path.substring(1).indexOf("/") > 0 ? path.substring(path.substring(1).indexOf("/") + 1) : ""
      return resolve(this.global.setup.folders[rootName] + remainingPath)
    } else {
      throw "Unknown folder"
    }
  }

  realPathToVirtual(path){
    let resolvedPath = resolve(path)
    for(let folderName in this.global.setup.folders){
      let fpath = resolve(this.global.setup.folders[folderName])
      if(resolvedPath.startsWith(fpath)){
        if(path == fpath)
          return "/" + folderName
        else
          return `/${folderName}/${path.substring(fpath.length + 1).replace(/\\/g, "/")}`
      }
    }
    throw "Unknown real path: " + path
  }

  validateAccessToRootFolder(folderName){
    //return this.mscp.server.security.validateAccess()
  }

  validateAccessToFile(id, requireWrite){
    this.global.accessManager.validateAccessReadWriteThrow(this.request.data.accessToken, id, requireWrite)
  }
}

module.exports = Handler

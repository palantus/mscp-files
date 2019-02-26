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

class Handler{

  async initFirst(){
    this.global.setup = await new Promise((r) => fs.readFile(path.join(__dirname, "setup.json"), "utf-8", (err, file) => r(JSON.parse(file))))

    if(!this.global.setup.baseurl)
      this.global.setup.baseurl = "http://localhost"

    this.reindex()
  }

  async reindex(){

    let id = md5("/")
    this.mscp.meta.setProperty(id, "name", "root")
    this.mscp.meta.setProperty(id, "path", "/")
    this.mscp.meta.setProperty(id, "parentpath", "")
    this.mscp.meta.setProperty(id, "type", "folder")
    this.mscp.meta.removeTag(id, "deleted")

    let folders = this.global.setup.folders || {}
    for(let folderName in folders){
      let folder = path.resolve(folders[folderName])
      await this.reindexFilesOfPath(folder)

      id = md5("/"+folderName)
      this.mscp.meta.setProperty(id, "name", folderName)
      this.mscp.meta.setProperty(id, "path", "/"+folderName)
      this.mscp.meta.setProperty(id, "parentpath", "/")
      this.mscp.meta.setProperty(id, "type", "folder")
      this.mscp.meta.removeTag(id, "deleted")
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
      let file = this.mscp.meta.find(`id:${id}`)

      if(isDir){
        this.reindexFilesOfPath(fullPath)

        if(!file){
          //TODO: Add folder metadata
        }
        //TODO: this code needs to only happen on unknown folders
        this.mscp.meta.setProperty(id, "name", d)
        this.mscp.meta.setProperty(id, "path", vPath)
        this.mscp.meta.setProperty(id, "parentpath", vPathParent)
        this.mscp.meta.setProperty(id, "type", "folder")
        this.mscp.meta.removeTag(id, "deleted")
      } else {
        if(file){
          //TODO: check date, size etc.
        } else {
          //TODO: Add file metadata
        }
        //TODO: this code needs to only happen on unknown files
        this.mscp.meta.setProperty(id, "name", d)
        this.mscp.meta.setProperty(id, "path", vPath)
        this.mscp.meta.setProperty(id, "parentpath", vPathParent)
        this.mscp.meta.setProperty(id, "type", "file")
        this.mscp.meta.removeTag(id, "deleted")
        console.log(vPath)
      }
    }

    this.fillMissingHashes();
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
    let files = (await this.mscp.meta.find(`prop:type=file prop:hash= !tag:deleted`, true))
    for(let file of files){
        let filename = this.virtualPathToReal(file.properties.path);
        let hash = await md5File(filename)
        if(hash) {
          this.mscp.meta.setProperty(file.id, "hash", hash)
          console.log(`Filled hash of file: ` + file.properties.path)
        }
    }
  }

  async download(hash){
    let file = (await this.mscp.meta.find(`id:"${hash}"|prop:"hash="${hash}"`, true))[0]

    if(!file)
      throw "Unknown file"

    let filename = this.virtualPathToReal(file.properties.path);
    let isFile = await new Promise((r) => fs.lstat(filename, (err, stats) => r(stats.isFile(filename))))
    if(!isFile)
      throw `${hash} is a directory`

    return {name: this.global.hashToFilename[hash], path: filename}
  }

  async raw(hash){
    let file = (await this.mscp.meta.find(`id:"${hash}"|prop:"hash=${hash}"`, true))[0]

    if(!file)
      throw "Unknown file"

    let filename = this.virtualPathToReal(file.properties.path);
    let isFile = await new Promise((r) => fs.lstat(filename, (err, stats) => r(stats.isFile(filename))))
    if(!isFile)
      throw `${hash} is a directory`

    this.request.res.sendFile(filename)
  }

  async file(id){
    /*
    console.log(`Access key: ${this.request.req.mscp.accessKey}`)

    if(this.global.hashToFilename[id] === undefined)
      throw "Unknown file"

    let filename = this.global.hashToFilename[id];

    return {
      filename: filename,
      id: id,
      path: this.global.hashToPath[id],
      md5: await md5File(this.virtualPathToReal(this.global.hashToPath[id])),
      mime: mime.lookup(this.global.hashToFilename[id]),
      links: {
        raw: `${this.global.setup.baseurl}/api/raw/${id}/${filename}`,
        download: `${this.global.setup.baseurl}/api/download/${id}/${filename}`,
        self: `${this.global.setup.baseurl}/api/file/${id}/${filename}`
      }
    }
    */
    return null;
  }

  async folder(hashOrPath){
    let folder = null;
    if(hashOrPath.length == 32 && hashOrPath.indexOf("/") < 0){ //hash
      folder = (await this.mscp.meta.find("id:"+hashOrPath, true))[0];
    } else {
      folder = (await this.mscp.meta.find('prop:path=' + hashOrPath, true))[0];
    }

    if(!folder)
      throw "Unknown folder: " + hashOrPath

    let folderContent = await this.mscp.meta.find("prop:parentpath=" + folder.properties.path + " !tag:deleted", true)
    for(let i = folderContent.length - 1; i >= 0; i--){
      let filename = this.virtualPathToReal(folderContent[i].properties.path);
      let exists = await new Promise(resolve => fs.stat(filename, (err, stat) => resolve(err == null ? true : false)))
      if(!exists){
        this.mscp.meta.addTag(folderContent[i].id, "deleted")
        folderContent.splice(i, 1)
      }
    }

    return {
      name: folder.properties.name,
      id: folder.id,
      parentPath: folder.properties.parentpath,
      path: folder.properties.path,
      content: folderContent,
      links: {
        parent: folder.properties.parentpath ? `${this.global.setup.baseurl}/api/folder/?hash=${folder.properties.parentpath}` : null,
        self: `${this.global.setup.baseurl}/api/folder/?path=${folder.properties.path}`
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

    await this.reindex(); //TODO: nok for ineffektivt

    let ret = []
    for(let f of files){
      console.log(f)
      ret.push(await this.file(md5(f)))
    }

    this.fillMissingHashes();

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
    let file = (await this.mscp.meta.find(`id:${id}`, true))[0]

    if(!file)
      throw "Unknown file/folder"

    await this.mscp.meta.addTag(file.id, "deleted")
    let filename = this.virtualPathToReal(file.properties.path);

    console.log("Deleting: " + filename)
    await del(filename, {force: true})
    return true;
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

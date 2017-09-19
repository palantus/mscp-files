"use strict"

const guid = require("guid")
const moment = require("moment")
const AccessTokenManager = require("mscp-accesstokens");
const fs = require("fs")
const path = require("path")

class Handler{

  async initFirst(){
    this.global.accessManager = new AccessTokenManager({secret: this.mscp.setupHandler.setup.accessTokenSecret, alwaysFullAccess: this.mscp.setupHandler.setup.useAccessTokens !== true})
    this.global.setup = await new Promise((r) => fs.readFile(path.join(__dirname, "setup.json"), "utf-8", (err, file) => r(JSON.parse(file))))
  }

  async reindex(){
    let folders = this.global.setup.folders || []
    for(let folder of folders){
      console.log(await this.getAllFilesOfDir(folder))
    }
  }

  async getAllFilesOfDir(path){
    const { promisify } = require('util');
    const { resolve } = require('path');
    const fs = require('fs');
    const readdir = promisify(fs.readdir);
    const rename = promisify(fs.rename);
    const stat = promisify(fs.stat);

    async function getFiles(dir) {
      const subdirs = await readdir(dir);
      const files = await Promise.all(subdirs.map(async (subdir) => {
        const res = resolve(dir, subdir);
        return (await stat(res)).isDirectory() ? getFiles(res) : res;
      }));
      return files.reduce((a, f) => a.concat(f), []);
    }

    return await getFiles(path)
  }

  validateAccessToFile(id, requireWrite){
    this.global.accessManager.validateAccessReadWriteThrow(this.request.data.accessToken, id, requireWrite)
  }
}

module.exports = Handler

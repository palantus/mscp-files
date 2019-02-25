/*
$(function() {
    init();
})


async function init(){
  await mscp.ready;
  $("#fileupload").submit(function (event) {
    event.preventDefault();
    fileUploadClicked($(this)[0])
    return false;
  });
}
*/
function fileUploadClicked(folderView, form, filesChosen){
  var formData = new FormData(form);
  for(let file of filesChosen.files){
    readFile(folderView, file, formData)
  }
}

function readFile(folderView, file, formData){
  var reader = new FileReader();

  reader.onloadend = async function(event) {
    let binary = reader.result;//event.target.result;
    let md5 = CryptoJS.MD5(CryptoJS.enc.Latin1.parse(binary)).toString()

    doUploadFile(folderView, formData)
  };

  reader.readAsBinaryString(file);
}

function doUploadFile(folderView, formData, accessKey){
  $.ajax({
        url: '/api/upload?folder=' + folderView.folder.id + (accessKey ? "&accessKey=" + accessKey : ''),
        type: 'POST',
        data: formData,
        async: true,
        cache: false,
        contentType: false,
        processData: false,
        success: function (returndata) {
          let files = returndata.result;
          /*
          for(let f of files){
            $("#uploadedfiles").append(`<tr><td>${f.filename}</td><td><a href="${f.links.download}">Download</a> <a href="${f.links.raw}">Raw</a></td></tr>`)
          }
          */
          folderView.refreshContent()
          $(".toolbarbutton").removeClass("open")
        },
        error: function(e){
          if(e.status == 403){
            let key = prompt("You do not have access to this functionality. Enter an access key to continue.")
            if(key){
              return doUploadFile(formData, key)
            } else {
              throw "No AccessKey entered"
            }
          } else {
            alert("Could not upload file");
          }
        }
    });
}

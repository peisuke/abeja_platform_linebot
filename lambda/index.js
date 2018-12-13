'use strict';
const line = require('@line/bot-sdk');
const client = new line.Client({channelAccessToken: process.env.ACCESSTOKEN});
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var gm = require('gm').subClass({ imageMagick: true });
const request = require('request');

exports.handler = async function (event, context) {
  let body = JSON.parse(event.body);
  const replyToken = body.events[0].replyToken;

  if (replyToken === '00000000000000000000000000000000') { //接続確認エラー回避
    let lambdaResponse = {
      statusCode: 200,
      headers: { "X-Line-Status" : "OK"},
      body: '{"result":"connect check"}'
    };
    context.succeed(lambdaResponse);
  } else {
    let data = body.events[0];

    var ret = await getMessage(data);

    var response = await client.replyMessage(body.events[0].replyToken, ret);
    let lambdaResponse = {
      statusCode: 200,
      headers: { "X-Line-Status" : "OK"},
      body: '{"result":"completed"}'
    };
    context.succeed(lambdaResponse);
  }
};

var getMessage = async (data)=> {
  var message = null;
  switch (data.type){
    case 'message':
      if(data.message.type == 'image') {
        var img = await getImage(data.message.id);
        var result = await doDetection(img);
        var url = await saveImage(result);
        var ret = {
          type: 'image',
          originalContentUrl: url.originalURL,
          previewImageUrl: url.resizedURL
        };
        return ret;
      } else {
        var ret = {
          type: 'text',
          text: 'Please post your image.'
        };
        return ret;
      }
  }
};


var getImage = async function(messageId) {
  return new Promise((resolve, reject) => {
    client.getMessageContent(messageId).then((stream) => {
      var content = [];
      stream.on('data', (chunk) => {
        content.push(new Buffer.from(chunk));
      }).on('error', (err) => {
        reject(err);
      }).on('end', function(){
        resolve(Buffer.concat(content));
      });
    });
  });
};

var doDetection = async (data)=> {
  const requestOptions = {
    url: process.env.API_ENDPOINT_DETECTION,
    method: "POST",
    headers: {
      'Content-Type':'image/jpeg',
    },
    auth: {
      user:process.env.ABEJA_PLATFORM_USER_ID,
      password: process.env.ABEJA_PLATFORM_USER_TOKEN
    },
    encoding: null,
    body: data
  };
  var response = await doRequest(requestOptions);
  var ret = new Buffer.from(response);
  return ret;
};

var doRequest = function (options) {
  return new Promise(function (resolve, reject) {
    request(options, function (error, res, body) {
      if (!error && res.statusCode == 200) {
        resolve(body);
      } else {
        reject(error);
      }
    });
  });
}

var saveImage = async (data)=> {
  var nowDate = new Date();
  var nowTime = nowDate.getTime();
  var filename = nowTime + '.jpg';
  await saveImageToS3(data, filename);

  var resizedFilename = nowTime + '_thumbnail.jpg';
  var resizedData = await resizeImage(data);
  await saveImageToS3(resizedData, resizedFilename);

  var originalURL = await getSignedUrl(filename);
  var resizedURL = await getSignedUrl(resizedFilename);

  var ret = {
    'originalURL': originalURL,
    'resizedURL': resizedURL
  };
  return ret;
};

var saveImageToS3 = async (image, filename) => {
  return new Promise((resolve, reject) => {
    var params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: filename,
      Body: image
    };
    s3.putObject(params, function(err, data) {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

var resizeImage = async function(image) {
  return new Promise((resolve, reject) => {
    gm(image).resize(240).toBuffer('jpg', function(err, buf) {
      if (err) {
        reject(err);
      } else {
        resolve(buf);
      }
    });
  });
};

var getSignedUrl = async (filename) => {
  return new Promise((resolve, reject) => {
    var params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: filename,
      Expires: 3600
    };
    s3.getSignedUrl('getObject', params, function (err, url) {
      if (err) {
        reject(err);
      } else {
        resolve(url);
      }
    });
  });
};

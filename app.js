const fs = require('fs');
const express = require('express');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
var app = express();

const port = 80;

app.get(/^\/$|^\/index(?:\.html)?$/, async function(req, res) {
  res.sendFile(`index.html`, { root: __dirname });
});

if (!fs.existsSync("./ytvideos/")){
  fs.mkdirSync("./ytvideos");
}
app.get('/api/ytdl', async function(req, res) {
  try {
    var videoUrl = decodeURIComponent(req.query.v);
    if (!ytdl.validateURL(videoUrl)) {
      res.status(400).end();
      return;
    }

    // Download video
    var readableStream = ytdl(videoUrl);
    readableStream.on('info', (info, format) => {
      var fileDestination = `ytvideos/${info.videoDetails.title.replace(/[/\\?%*:|"<>]/g, '_')} - ${info.videoDetails.ownerChannelName.replace(/[/\\?%*:|"<>]/g, '_')}.${format.container}`;
      var stream = readableStream.pipe(fs.createWriteStream(fileDestination));
      stream.on('finish', async function() {
        try {
          if (req.query.format || req.query.ss || req.query.t) {
            var ffmpegCmd = ffmpeg(fileDestination);
            var modifiedFileDestination = `${fileDestination.substring(0, fileDestination.lastIndexOf('.'))} modified.${format.container}`;
            // Trim video
            if (req.query.ss) ffmpegCmd.seekInput(req.query.ss);
            if (req.query.t) ffmpegCmd.duration(req.query.t);
            // Video conversion in other formats
            if (req.query.format && req.query.format != format.container) {
              modifiedFileDestination = `${modifiedFileDestination.substring(0, modifiedFileDestination.lastIndexOf('.'))}.${req.query.format}`;
            }
            ffmpegCmd.output(modifiedFileDestination).on('end', async function() {
              res.download(modifiedFileDestination, modifiedFileDestination.replace(/^.*[\\\/]/, ''));
              fs.unlinkSync(fileDestination);
            }).run();
          } else {
            res.download(fileDestination, fileDestination.replace(/^.*[\\\/]/, ''));
          }
        } catch(error) {}
      });
    });
  } catch (error) {
    console.log(error);
    res.status(500).end();
  }
});

setInterval(async function() {
  // Delete YouTube videos after two hours
  try {
    fs.readdirSync('ytvideos/').forEach(file => {
      var { birthtimeMs } = fs.statSync(`ytvideos/${file}`);
      if (Date.now() - birthtimeMs >= 7200000) {
        fs.unlinkSync(`ytvideos/${file}`);
      }
    });
  } catch (error) {
    console.log(error);
  }
}, 5000);

// 404 Page
app.use(async function(req, res){
  res.status(404).send("<h1>Error 404</h1>This page doesn't exist!");
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
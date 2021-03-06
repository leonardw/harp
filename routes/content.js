
/*
 * GET users listing.
 */
	var fs = require('fs'),
	path = require('path'),
	request = require('request'),
	mime = require('mime'),
	regesc = require('escape-regexp'),
	config = require('../config'),
	queue = require('../lib/queue-reader'),
	DEFAULT_CONTENT_TYPE = "text/html",
	CONTENT_ROOT = config.DocumentRoot || './docroot',
	UTF8_ENCODING = 'utf8';

	/*
	{
		filename:
		data:
		type:
		message:
	}
	*/
	function render(err, res, content) {
		var statusCode = err || 200,
		contentType = content.type || DEFAULT_CONTENT_TYPE,
		contentLength = content.data.length,
		info = content.message || content.filename || "";
		
		res.statusCode = statusCode;
		res.setHeader("Content-Type", contentType);
		res.setHeader("Content-Length", contentLength);
		
		console.info("%s|%d|%s|%d|%s", new Date(), statusCode, contentType, contentLength, info);
		
		res.send(content.data);
	}
	
	function renderFile(err, req, res, file, ext) {
		var statusCode = err||200;
		
		if (statusCode == 404 && config.ReverseProxyEnable) {
			var originUrl = "http://"+ config.OriginHost +":"+ config.OriginPort + req.url;
			console.log("----origin url:", originUrl);
			req.pipe(request(originUrl)).pipe(res);
			return;
		}
		
		if (file) {
			fs.readFile(file, UTF8_ENCODING, function(ex, data) {
				if(ex) {
//					console.error("Could not open file: %s", ex);
					render(500, res, {
						data: "<h1>Unable to read file</h1>\n<p>File: <span style=\"color:red\">"+file+"</span></p>\n<pre style=\"background-color:#D8D8D8\">"+ex+"</pre>",
						message: ex
					});
					return;
				}
				
				var contentType;
				if (ext) {
//					console.log("Looking up MIME for extension ", ext);
					contentType = mime.lookup(ext);
				}
				if (!contentType) {
//					console.log("MIME not found. Using default.");
					//contentType = DEFAULT_CONTENT_TYPE;     //???really?
				}

				render(statusCode, res, {
					filename: file,
					data: data,
					type: contentType
				});
			});	
		} else {
			render(404, res, {
				data: "<h1>No matching files found</h1>"
			});
		}
	}

exports.show = function(req, res){
	var url = req.url;
	
//	console.log('URL:',url);
	
	var reqDir = path.join(CONTENT_ROOT, path.dirname(url));
	var reqExt = path.extname(url);
	var reqFile = path.basename(url, reqExt);
	
//	var pattern = new RegExp("^("+regesc(reqFile+reqExt)+"(\\.[0-9]+)?|"+regesc(reqFile)+"\\.[0-9]+"+regesc(reqExt)+")$");
	var pattern = new RegExp("^("+regesc(reqFile)+"("+regesc(reqExt)+")(\\.[0-9]+)?(\\.[^ \\.]+)?|"+regesc(reqFile)+"\\.[0-9]+("+regesc(reqExt)+"))$");
	
//	console.log("reqDir:[%s] reqFile:[%s] reqExt:[%s]", reqDir, reqFile, reqExt);
//	console.log('regex:',pattern);
	
	if ( !(fs.existsSync(reqDir)) || !(fs.statSync(reqDir).isDirectory()) ) {
//		console.log("dir not found %s", reqDir);
		return renderFile(404, req, res, null);
	}
		
		queue.next(reqDir+"/"+reqFile+reqExt, req, function(err, file){
			if (!err) {
				var extMatch = path.basename(file).match(pattern);
				
//				console.log('---file: ['+file+']');
//				console.log('basename:',path.basename(file));
//				console.log('---extMatch\n',extMatch);
				
				var mimeExt;
				if (extMatch) {
					mimeExt = (extMatch[5] || extMatch[4] || extMatch[2] || "").substring(1);
				} else {
					mimeExt = path.extname(file).substring(1);
				}
//				console.log('----Extension--['+mimeExt+']');
//				console.log("------file----", file);
				return renderFile(null, req, res, file, mimeExt);
			}
			
//			console.error("----ERR:", err.code);
//			console.error("----ERR:", err.message);
			if (err.code != "ENOENT") {
				return renderFile(404, req, res, null);
			}
			
			
			
			fs.readdir(reqDir, function(err, files){
				var matches = files.filter(function(f) {
					return ( pattern.test(f) && fs.statSync(reqDir+"/"+f).isFile() );
				});
				
				var count = matches.length;
//				console.log("Matches:\n", matches);
//				console.log("Count: ", count);
				
				if (count===0) {
					return renderFile(404, req, res, null); //no file found
				} else {
					var rand = Math.floor(Math.random()*count);
					var file = matches[rand];
//					file = "./zzzzz.zz";
//					console.log('Response file:', file);
					
					var extMatch = file.match(pattern);
					var mimeExt = (extMatch[5] || extMatch[4] || extMatch[2] || "").substring(1);
//					console.log('----Extension--['+mimeExt+']--\n',extMatch);
					
					return renderFile(null, req, res, reqDir+"/"+file, mimeExt);
				}				
			});
				
				
				
				
			
			
		});
		
//	console.log("------Request",req);
	//console.log("------Response",res);
};


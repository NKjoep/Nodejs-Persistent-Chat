//imports
	var _ = underscore 	= require('underscore');
	var argv 			= require('optimist').argv;
	var connect			= require('connect');
	var cookie			= require('cookie');
	var ejs 			= require('ejs');
	var express 		= require('express');
	var http 			= require('http');
	var socketIo 		= require('socket.io');
	var crypto 			= require('crypto');
	var mongodb			= require('mongodb');
	var ChatServer		= require('./ChatServer/ChatServer.js')

//options
	var options = _.extend({
		port: process.env.PORT||argv.p||argv.port||8000,
		mongoUrl: process.env.MONGO_CONNECTION_STRING||'mongodb://admin:admin@localhost:27017/db',
		messagesCollection: process.env.MONGO_MESSAGES_COLLECTION||"ChatServer-Messages",
		usersCollection: process.env.MONGO_USERS_COLLECTION||"ChatServer-Users"
	}, argv);


//mongodb
	var MongoClient = mongodb.MongoClient;


//app server
	this.app = app = express();
	app.configure(function() {
		app.set('views', __dirname+"/../views/"); //folder of the compiled views
		app.use(express.static(__dirname + "/../static/")); //static folder, call it as the root
		app.set('view engine', 'ejs');
		app.set("view options", {layout: false});
		app.engine('html', require('ejs').renderFile);
		app.use(express.bodyParser());
		app.use(connect.cookieParser());
 		app.use(connect.cookieSession({
 			key: 'ChatServer',
 			secret: 'secret', 
 			cookie: { maxAge: 60 * 60 * 1000 }
 		}));
	});
	app.engine('html', require('ejs').renderFile);


//utility
	var viewLocals = function(req, otherParams) {
		return _.extend({
			_: underscore,
			session: req.session,
			queryString: req.query
		}, otherParams)
	};


//using
	app.use(function(req, res, next){
		//on each request coming to our server...
		next();
	});


//routing
	app.get('/', function(req, res) {
		if (req.session.chatserver) {
			res.render('index', viewLocals(req));
		}
		else {
			res.redirect('login');
		}
	});

	app.all('/login', 
		function loadUser(req, res, routingCallBack) {
			res.chatserver = { 
				'user': null
			};
			res.ERRORMESSAGE = null;
			if (req.body && req.body.username && req.body.password) {
				MongoClient.connect(options.mongoUrl, function(err, db) {
					if (err) { console.log("error connection", err); res.ERRORMESSAGE='Login problem. Try later.'; routingCallBack(); }
					else if (!err) {
						if (db!=null) {
							var query = {
								'username': req.body.username, 
								'password': crypto.createHash("md5").update(req.body.password).digest("hex")
							};
							var result = db.collection(options.usersCollection).find(query).nextObject(function(err, result) {            
								if (err) { console.log('error query', err); res.ERRORMESSAGE='Login problem. Try later.'; }
								else {
									res.chatserver.user = result;
									db.close();
								}
								routingCallBack();
							});
						}
					}
				});
			}
			else {
				routingCallBack();
			}
		},
		function (req, res) {
			if (res.chatserver.user) {
				req.session.chatserver = {
					username: res.chatserver.user.username,
					logged_in: true,
					last_login: new Date()
				};
				res.redirect('/');
			}
			else if (res.ERRORMESSAGE || req.body.username || req.body.password) {
				res.ERRORMESSAGE = res.ERRORMESSAGE||'Wrong username or password';
			}
			res.render('login', _.extend(
				viewLocals(req), 
				{ERRORMESSAGE: res.ERRORMESSAGE}));
		}
	);

	app.all('/logout', function (req, res) {
		req.session = null;
		res.redirect('/');
	});

	app.get('/adduser', function(req, res) {
		if (req.param('username') && req.param('password')) {
			MongoClient.connect(options.mongoUrl, function(err, db) {
				if (err) { console.log("error connection", err); }
				else if (!err) {
					if (db!=null) {
						db.collection(options.usersCollection).insert({
							'username': req.param('username'), 
							'password': crypto.createHash("md5").update(req.param('password')).digest("hex")
						}, function(err, result){
							db.close();
						});
					}
				}
			});
		}
		res.redirect('/');
	});

	var httpServer = http.createServer(app);


//socket
	var socketHandleConnect = function(socket) {
		var userData = socket.handshake.chatserver;
		if (socketServer.chatserver==undefined) {
			socketServer.chatserver = {};
		} 
		if (socketServer.chatserver[userData.username]!=undefined) {
			var destroyId = socketServer.chatserver[userData.username];
			if (socketServer.sockets.sockets[destroyId]) {
				socketServer.sockets.sockets[destroyId].send(ChatServer.messageStandard('closed session.'));
				socketServer.sockets.sockets[destroyId].disconnect();
			}
		}
		socketServer.chatserver[userData.username] = socket.id;
		socket.broadcast.send(ChatServer.connectNick(userData.username));
		socket.removeAllListeners('message');

		var myThis = this;
		var cbSetup = function() {
			socket.on('message', function(message) {
				socketHandleMessage(socket,message);
			}.bind(myThis));
		};

		MongoClient.connect(options.mongoUrl, function(err, db) {
			if (err) { console.log(err) }
			else if (!err) {
				if (db!=null) {
					db.collection(options.messagesCollection).find().limit(150).sort({date: -1}).toArray(function(err, results){
						if (!err && results) {
							results = results.reverse();
							_.each(results, function(result) {
								socket.emit('chatserver-message',
									ChatServer.messageNick(result.user, result.message, new Date(result.date)) 
								);
							});
						}
						db.close();
						cbSetup();
					}); 
				}
				else {
					db.close();
					cbSetup();
					console.log('db is null');
				}
			}
		});
	};

	var socketHandleMessage = function(socket, message) {
		var message = message.trim();
		if(message.length > 0) {
			var submex = ChatServer.messageNick(socket.handshake.chatserver.username,message); 
			
			socket.emit("chatserver-message", submex);
			socket.broadcast.emit("chatserver-message",submex);
			
			MongoClient.connect(options.mongoUrl, function(err, db) {
				if (err) { console.log(err) }
				else if (!err) {
					if (db!=null) {
						db.collection(options.messagesCollection).insert({
							date: new Date(),
							user: socket.handshake.chatserver.username,
							message: message
						},function(err, result) {
							db.close();
							if (err) { console.log(err); return; }
						});
					}
					else {
						db.close();
						console.log('db is null');
					}
				}
			});
		}
	};

	socketServer = socketIo.listen(httpServer,{ log: false });
	socketServer.configure(function () { 
  		socketServer.set("transports", ["xhr-polling"]); //just for compatibility with Heroku
  		socketServer.set("polling duration", 10); 
	});

	socketServer.set('authorization', function (handshakeData, accept) {
		if (handshakeData.headers.cookie) {
			handshakeData.cookie = cookie.parse(handshakeData.headers.cookie);
			var myappCookie = handshakeData.cookie['ChatServer'];
			try {
				var data = connect.utils.parseJSONCookie(connect.utils.parseSignedCookie(myappCookie, 'secret'));
			}
			catch (e) {}
			if (data.chatserver == undefined || (!(data.chatserver.logged_in && data.chatserver.username))) {
				return accept('Cookie is invalid.', false);
			}
			else {
				handshakeData.chatserver = data.chatserver;
			}
		} 
		else {
			return accept('No cookie transmitted.', false);
		} 
		accept(null, true);
	});

	socketServer.sockets.on('connection', socketHandleConnect);

//start
	httpServer.listen(options.port);
	console.log("app started: http://localhost:"+options.port+"/");
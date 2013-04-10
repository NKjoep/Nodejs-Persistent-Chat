jQuery(function(){
	/*
	window.normalizedNow = function() {
		var now = new Date();
		now.setMilliseconds(0);
		now.setMinutes(0);
		now.setSeconds(0);	
		return now; 
	};
	var dateDifference = (serverDate-now)/1000/60/60;
	*/

	var scroller;

	var scrollPageDown = function() {
		if (scroller) { clearTimeout(scroller); }
		scroller = setTimeout(function() {
			jQuery("html, body").animate({ scrollTop: jQuery(document).height()-jQuery(window).height() }, 40);
		}, 15);
	};

	var output = function output (text) {
		$(text).appendTo(jQuery('#websocket-output'));
		scrollPageDown();
	}
	
	var outputChatServerMessage = function outputChatServerMessage(obj) {
		obj.date = new Date(obj.date);
		obj.date = obj.date.toFormattedString('ddd dd MMM hh:mm:ss');
		output(
			$.tmpl( $("#messageTemplate"), obj)
		)
		scrollPageDown();
	};

	var socket = io.connect(window.location.href);
	
	socket.on('message', function (message) {
		output($.tmpl( $("#simpleTextTemplate"), {text: message}));
	});
	
	socket.on('chatserver-message', outputChatServerMessage);

	socket.on('closedSession', function (message) {
		output($.tmpl( $("#simpleTextTemplate"), {text: 'disconnected'}));
	});

	var inputHistory = []; 
	var currentPointerHistory = [0];
	var updateHistory = function(text) {
		if (text==undefined) {
			text = $('#inputData').val(); 
		}
		if (text!=inputHistory[inputHistory.length-1]) {
			inputHistory.push(text);
			inputHistory = inputHistory.slice(-50);
		}
		currentPointerHistory = inputHistory.length;
	};

	$('#submitData').on('click', function(ev){
		ev.preventDefault();
		socket.send($('#inputData').val());
		$('#inputData').val("");
		updateHistory();
	});

	$('#submitDataBig').on('click', function(ev){
		ev.preventDefault();
		socket.emit('message-big', { 
			message: $('#inputData').val()
		});
		$('#inputData').val("");
		updateHistory();
	});


	$('#inputData').on('keydown', function(ev){
		if (ev.keyCode == 13) {
			ev.preventDefault();
			var text = $('#inputData').val(); 
			socket.send(text);
			$('#inputData').val("");
			updateHistory(text);
		}
		else if (ev.keyCode==38) {
			ev.preventDefault();
			currentPointerHistory = (currentPointerHistory-1) > 0 ? currentPointerHistory-1 : 0;
			$('#inputData').val(inputHistory[currentPointerHistory]);
		}
		else if (ev.keyCode==40) {
			ev.preventDefault();
			$('#inputData').val(inputHistory[currentPointerHistory+1]);
			currentPointerHistory = (currentPointerHistory+1) > inputHistory.length ? inputHistory.length : currentPointerHistory+1;
		}
	});

	$('#inputData').focus();


	//notification
	if (window.webkitNotifications.checkPermission() == 0) { // 0 is PERMISSION_ALLOWED
		// function defined in step 2
		window.webkitNotifications.createNotification(null, 'Notification Title', 'Notification content...');
	} 
	else {
		window.webkitNotifications.requestPermission();
	}


});
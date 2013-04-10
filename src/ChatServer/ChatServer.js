exports.messageStandard = function(text, date){
	return {
		date: date||new Date(),
		text:  text
	};
};

exports.messageNick = function(nick, text, date) {
	return {
		text: text, 
		date: date||new Date(), 
		nick: nick
	};
};
exports.connectNick = function(nick) {
	return nick + ' connected.';
};
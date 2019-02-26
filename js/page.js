
function formatColor(c, a) {
	var values = c.map(Math.round);
	values.push((a >= 0) && (a <= 255) ? a/255 : 1);
	return 'rgba(' + values.join(',') + ')';
}

var app = new Vue({
	el: '#app-outer',
	data: {
		connections: [
		]
	},
	
	created: function() {
		var conn = {
			my_did: "5oVR1NowLBj4XrhepcKNP6hcqrmPJgWxDpB72WBDfFMt",
			their_did: "AsSMancnGXr7iq2hCABnzmHvHRB8dEMWJRMKB1k2aZny",
			label: "Indy Reference Agent",
			status: "invited",
			activity: [
				{
					"type": "message",
					"content": "Hi yourself",
					"direction": "sent",
					"time": "2018-12-24 18:24:07Z"
				},
				{
					"type": "message",
					"content": "Hello there",
					"direction": "received",
					"time": "2018-12-24 18:24:07Z"
				},
				{
					"type": "ping",
					"direction": "received",
					"time": "2018-12-24 18:24:07Z"
				},
				{
					"type": "ping",
					"direction": "sent",
					"time": "2018-12-24 18:24:07Z"
				},
				{
					"type": "response",
					"direction": "received",
					"time": "2018-12-24 18:24:07Z"
				},
				{
					"type": "request",
					"direction": "sent",
					"time": "2018-12-24 18:24:07Z"
				},
				{
					"type": "invitation",
					"direction": "received",
					"time": "2018-12-24 18:24:07Z"
				}
			]
		}
		var image = new Identicon(conn.their_did, { format: 'svg', size: 84 });
		var rgbColor = image.foreground;
		conn.color = formatColor(rgbColor);
		conn.image = 'data:image/svg+xml;base64,' + image.toString();
		this.connections.push(conn);
	}
});

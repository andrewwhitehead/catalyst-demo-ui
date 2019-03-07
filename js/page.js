
function formatColor(c, a) {
	var values = c.map(Math.round);
	values.push((a >= 0) && (a <= 255) ? a/255 : 1);
	return 'rgba(' + values.join(',') + ')';
}

var TEST_CONNECTIONS = [
	{
		connection_id: "6a6e6485-8d10-4507-8edb-e65939b0321e",
		my_did: "Re5DLGLcLpZ6rRmZZC5APx",
		their_did: "3A1vTYjcMKbaE6ttjzxsPN",
		their_label: "Indy Reference Agent",
		state: "active",
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
];

var app = new Vue({
	el: '#app-outer',
	data: {
		app_url: "http://localhost:5000",
		app_label: '',
		app_endpoint: '',
		connections: [],
		conn_status: null,
		conn_error: '',
		input_invite_url: '',
		mode: "settings",
		ping_timeout: null,
		recvd_invite_url: '',
		socket: null
	},
	created: function() {
	},
	mounted: function() {
		// TEST_CONNECTIONS.forEach(conn => this.addConnection(conn));
		// this.showConnections();
	},
	filters: {
		formatDate: function (value) {
			if(! value) return '';
			var options = {
				weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric'
			};
			return new Date(value).toLocaleString('en-US', options);
		}
	},
	methods: {
		showSettings() {
			this.mode = "settings";
		},
		showConnections() {
			this.mode = "connections";
			this.resync();
		},
		addConnection (conn) {
			this.expandConnection(conn);
			this.connections.push(conn);
		},
		updateConnection (conn) {
			var found;
			for(var idx = 0; idx < this.connections.length; idx ++) {
				if(this.connections[idx].connection_id === conn.connection_id)
					found = this.connections[idx];
			}
			if(found) {
				for(var k in conn) {
					found[k] = conn[k];
				}
				this.expandConnection(found);
			}
			return found;
		},
		mergeConnection (conn) {
			if(! this.updateConnection(conn))
				this.addConnection(conn);
		},
		expandConnection (conn) {
			if(conn.connection_id && ! conn.image) {
				var image = new Identicon(conn.connection_id, { format: 'svg', size: 84 });
				var rgbColor = image.foreground;
				conn.color = formatColor(rgbColor);
				conn.image = 'data:image/svg+xml;base64,' + image.toString();
			}
			conn.activity_count = 0;
			if(conn.activity) {
				for(var idx = 0; idx < conn.activity.length; idx++)
					if(conn.activity[idx].type === 'message')
						conn.activity_count ++;
			}
		},
		resync () {
			var self = this;
			clearTimeout(this.ping_timeout);
			var heartbeat = function() {
				clearTimeout(self.ping_timeout);
  				self.ping_timeout = setTimeout(function() {
					self.socket.close();
				}, 15000);
			}
			this.socket = new WebSocket(this.app_url.replace(/^https?:/, "ws:") + "/ws");
			this.socket.onmessage = function(event) {
				heartbeat();
				self.receiveMessage(JSON.parse(event.data));
			}
			this.socket.onopen = function(event) {
				heartbeat();
				self.fetchConnections();
				self.conn_error = null;
				self.conn_status = true;
			}
			this.socket.onerror = function(err) {
				self.conn_error = "Connection failed.";
				self.conn_status = false;
			}
			this.socket.onclose = function(err) {
				if(self.conn_status)
					self.conn_error = "Disconnected.";
				else
					self.conn_error = "Connection failed.";
				self.conn_status = false;
			}
		},
		receiveMessage (msg) {
			// console.log("received message: ", msg);
			if(msg.type === "ping") {
				// no action
			}
			else if(msg.type === "connection_update") {
				this.mergeConnection(msg.context.connection);
			}
			else if(msg.type == "settings") {
				this.app_label = msg.context.label;
				this.app_endpoint = msg.context.endpoint;
			}
		},
		fetchConnections () {
			var self = this;
			fetch(this.app_url + "/connections", {
				cache: "no-cache",
				headers: {
					"Content-Type": "application/json",
				}
			}).then(function(response) {
				if(response.ok) response.json().then(function(data) {
					self.connections = [];
					data.results.forEach(function(conn) {
						self.addConnection(conn);
					});
				});
			});
		},
		showDetail (conn_id) {
			var found;
			for(var idx = 0; idx < this.connections.length; idx ++) {
				if(this.connections[idx].connection_id === conn_id) {
					found = this.connections[idx];
					break;
				}
			}
			if(found) {
				this.conn_detail = found;
				this.mode = "connection_detail";
			}
		},
		showGenerate () {
			this.mode = "generate_invite";
			var self = this;
			fetch(this.app_url + "/connections/create-invitation", {
				cache: "no-cache",
				headers: {
					"Content-Type": "application/json",
				},
				method: "POST"
			}).then(function(response) {
				if(response.ok) response.json().then(function(data) {
					self.recvd_invite_url = data.invitation_url;
					var canvas = document.getElementById('invitation-qr');
					var qr = new QRious({
					  element: canvas,
					  value: self.recvd_invite_url,
					  size: 300
					});
				});
			});
		},
		copyInvite () {
			var self = this;
			navigator.permissions.query({name: "clipboard-write"}).then(function(result) {
			  	if(result.state == "granted" || result.state == "prompt") {
					navigator.clipboard.writeText(self.recvd_invite_url);
			  	}
			});
		},
		showReceive () {
			this.mode = "receive_invite";
			this.$nextTick(function() {
				var inp = document.getElementById("invite_url");
				inp.select();
			});
		},
		receiveInvite () {
			var url = this.input_invite_url, pos, invite_b64, invite_text,
				self = this;
			if(url) {
				pos = url.indexOf('c_i='), invite_b64;
				if(~pos) {
					invite_b64 = url.substring(pos + 4);
					invite_text = atob(invite_b64.replace(/_/g, '/').replace(/-/g, '+'));
					fetch(this.app_url + "/connections/receive-invitation", {
						cache: "no-cache",
						headers: {
							"Content-Type": "application/json",
						},
						method: "POST",
						body: invite_text
					}).then(function(response) {
						if(response.ok) response.json().then(function(data) {
							if(data.connection_id) {
								self.mergeConnection(data);
								self.showDetail(data.connection_id);
							} else {
								self.showConnections();
							}
						});
					});
				}
			}
		},
		acceptInvite (conn_id) {
			fetch(this.app_url + "/connections/" + conn_id + "/accept-invitation", {
				cache: "no-cache",
				method: "POST"
			}).then(function(response) {
				if(response.ok) response.json().then(function(data) {
					console.log("accepted invite:", data);
				});
			});
		},
		acceptRequest (conn_id) {
			fetch(this.app_url + "/connections/" + conn_id + "/accept-request", {
				cache: "no-cache",
				method: "POST"
			}).then(function(response) {
				if(response.ok) response.json().then(function(data) {
					console.log("accepted request:", data);
				});
			});
		},
		sendMessage (conn_id, target) {
			var msg = target.value;
			target.value = '';
			fetch(this.app_url + "/connections/" + conn_id + "/send-message", {
				cache: "no-cache",
				headers: {
					"Content-Type": "application/json",
				},
				method: "POST",
				body: JSON.stringify({content: msg})
			});
		},
		sendPing (conn_id) {
			fetch(this.app_url + "/connections/" + conn_id + "/send-ping", {
				cache: "no-cache",
				method: "POST"
			});
		}
	}
});


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
		autoconnect: true,
		app_url: "http://agentbook.vonx.io:5000",
		app_label: '',
		app_endpoint: '',
		connections: [],
		conn_detail_id: null,
		conn_status: null,
		conn_error: '',
		input_invite_url: '',
		mode: "settings",
		no_receive: false,
		ping_timeout: null,
		recvd_invite_id: null,
		recvd_invite_url: '',
		socket: null
	},
	created: function() {
	},
	mounted: function() {
		// TEST_CONNECTIONS.forEach(conn => this.addConnection(conn));
		if(this.autoconnect) {
			this.showConnections();
		}
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
	computed: {
		conn_detail() {
			if(this.conn_detail_id) {
				var found_idx = this.findConnection(this.conn_detail_id);
				if(found_idx !== null)
					return this.connections[found_idx];
			}
		}
	},
	methods: {
		showSettings() {
			this.mode = "settings";
		},
		showConnections(resync) {
			this.mode = "connections";
			if(! this.conn_status || resync)
				this.resync();
		},
		addConnection (conn) {
			this.expandConnection(conn);
			this.connections.push(conn);
		},
		findConnection (conn_id) {
			for(var idx = 0; idx < this.connections.length; idx ++) {
				if(this.connections[idx].connection_id === conn_id)
					return idx;
			}
			return null;
		},
		updateConnection (conn) {
			var found_idx = this.findConnection(conn.connection_id), found;
			if(found_idx !== null) {
				found = Object.assign({}, this.connections[found_idx]);
				for(var k in conn)
					found[k] = conn[k];
				this.expandConnection(found);
				this.$set(this.connections, found_idx, found);
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
			conn.invite_count = 0;
			if(conn.activity) {
				for(var idx = 0; idx < conn.activity.length; idx++) {
					if(conn.activity[idx].type === 'message') {
						conn.activity_count ++;
						if(conn.activity[idx].meta.copy_invite && ! conn.activity[idx].meta.copied)
							conn.invite_count ++;
					}
				}
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
			var socket_url = this.app_url.replace(/^https:/, "wss:").replace(/^http:/, "ws:") + "/ws";
			try {
				this.socket = new WebSocket(socket_url);
			} catch(e) {
				self.conn_error = "Connection failed.";
				self.conn_status = false;
				return;
			}
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
				this.no_receive = !! msg.context.no_receive_invites;
			}
		},
		fetchConnections () {
			var self = this;
			if(this.mode == "connection_detail") {
				this.mode = "connections";
				this.conn_detail_id = null;
			}
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
			var found_idx = this.findConnection(conn_id);
			if(found_idx !== null) {
				this.conn_detail_id = conn_id;
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
					self.recvd_invite_id = data.connection_id;
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
			var invite = document.getElementById('invitation-url');
			if(invite) {
				invite.focus();
				invite.select();
				var result = document.execCommand('copy');
				if(result === 'unsuccessful') {
					console.error('Failed to copy invitation.');
				}
			}
		},
		copyMessage (conn_id, row) {
			var self = this;
			var input = document.createElement('input');			
			input.style.visibility = 'none';
			input.style.position = 'absolute';
			input.style.left = '-9999px';
			input.style.top = window.scrollY + 100 + 'px';
			input.value = row.meta.content;
			document.body.appendChild(input);
			input.focus();
			input.select();
			var result = document.execCommand('copy');
			if(result === 'unsuccessful') {
				console.error('Failed to copy invitation.');
			} else {
				fetch(self.app_url + "/connections/" + conn_id + "/expire-message/" + row.id, {
					cache: "no-cache",
					method: "POST"
				});
			}
			document.body.removeChild(input);
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


function formatColor(c, a) {
	var values = c.map(Math.round);
	values.push((a >= 0) && (a <= 255) ? a/255 : 1);
	return 'rgba(' + values.join(',') + ')';
}

var app = new Vue({
	el: '#app-outer',
	data: {
		app_url: "http://agentbook.vonx.io:5000",
		app_label: '',
		app_endpoint: '',
		conn_active: false,
		conn_loading: false,
		conn_status: null,
		conn_error: '',
		help_link: null,
		invite_copied: false,
		invite_detail: null,
		invite_error: null,
		mode: "index",
		recvd_invite_id: null,
		recvd_invite_url: '',
		socket: null
	},
	created: function() {
	},
	mounted: function() {
		this.initApp();
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
		showIndex () {
			this.mode = "index";
			this.invite_copied = false;
			this.invite_detail = null;
			this.invite_error = null;
			this.recvd_invite_url = '';
		},
		initApp () {
			var self = this;
			clearTimeout(this.ping_timeout);
			var heartbeat = function() {
				clearTimeout(self.ping_timeout);
  				self.ping_timeout = setTimeout(function() {
					self.socket.close();
				}, 15000);
			}
			var socket_url = this.app_url.replace(/^https:/, "wss:").replace(/^http:/, "ws:") + "/ws";
			self.conn_active = false;
			self.conn_loading = true;
			try {
				this.socket = new WebSocket(socket_url);
			} catch(e) {
				self.conn_error = "Connection failed.";
				self.conn_loading = false;
				self.conn_status = false;
				return;
			}
			this.socket.onmessage = function(event) {
				// heartbeat();
				self.receiveMessage(JSON.parse(event.data));
			}
			this.socket.onopen = function(event) {
				// heartbeat();
				// self.fetchConnections();
				self.conn_error = null;
				self.conn_loading = false;
				self.conn_status = true;
			}
			this.socket.onerror = function(err) {
				self.conn_error = "Connection failed.";
				self.conn_loading = false;
				self.conn_status = false;
			}
			this.socket.onclose = function(err) {
				if(self.conn_status)
					; // self.conn_error = "Disconnected.";
				else
					self.conn_error = "Connection failed.";
				self.conn_loading = false;
				self.conn_status = false;
			}
		},
		receiveMessage (msg) {
			// console.log("received message: ", msg);
			if(msg.type === "ping") {
				// no action
			}
			else if(msg.type === "connection_update") {
				// this.mergeConnection(msg.context.connection);
			}
			else if(msg.type == "settings") {
				this.app_label = msg.context.label;
				this.app_endpoint = msg.context.endpoint;
				this.help_link = msg.context.help_link;
				this.no_receive = !! msg.context.no_receive_invites;
				if(this.app_label)
					document.title = this.app_label;
				this.conn_active = true;
				if(this.socket) this.socket.close();
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
					self.findInvite(data.results);
				});
			});
		},
		findInvite (conns) {
			var invites = [];
			for(var idx = 0; idx < conns.length; idx ++) {
				var conn = conns[idx];
				if(conn.activity) {
					for(var jdx = 0; jdx < conn.activity.length; jdx ++) {
						var act = conn.activity[jdx];
						if(act.type == "message" && act.meta.copy_invite && ! act.meta.copied) {
							invites.push({
								activity_id: act.id,
								connection_id: conn.connection_id,
								created_at: conn.created_at,
								their_label: conn.their_label,
								url: act.meta.content,
							});
						}
					}
				}				
			}
			if(invites.length) {
				var invite = invites[Math.floor(Math.random() * invites.length)];
				var image = new Identicon(invite.connection_id, { format: 'svg', size: 84 });
				var rgbColor = image.foreground;
				invite.color = formatColor(rgbColor);
				invite.image = 'data:image/svg+xml;base64,' + image.toString();
				var canvas = document.getElementById('invitation-qr');
				var qr = new QRious({
				  element: canvas,
				  value: invite.url,
				  size: 300
				});
				this.invite_detail = invite;
			} else {
				this.invite_error = "No pending invitations found.";
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
		showPartner () {
			this.mode = "partner_invite";
			this.invite_detail = null;
			this.invite_error = null;
			this.fetchConnections();
		},
		copyInvite () {
			var self = this;
			var invite = document.getElementById('invitation-url');
			var prev_copied = this.invite_copied;
			if(invite) {
				invite.focus();
				invite.select();
				var result = document.execCommand('copy');
				if(result === 'unsuccessful') {
					console.error('Failed to copy invitation.');
				} else {
					this.invite_copied = true;
				}
				if(! prev_copied) {
					var conn_id = this.invite_detail.connection_id;
					var act_id = this.invite_detail.activity_id;
					fetch(self.app_url + "/connections/" + conn_id + "/expire-message/" + act_id, {
						cache: "no-cache",
						method: "POST"
					});
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
		}
	}
});

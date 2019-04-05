
function formatColor(c, a) {
	var values = c.map(Math.round);
	values.push((a >= 0) && (a <= 255) ? a/255 : 1);
	return 'rgba(' + values.join(',') + ')';
}

function formatDate(value) {
	if(! value) return '';
	value = value.replace(/(\d{4}-\d{2}-\d{2}) /, "$1T");
	var options = {
		weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric'
	};
	return new Date(value).toLocaleString('en-US', options);
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

var TEST_MENU = {
	"@type": "did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/action-menu/1.0/menu",
	"@id": "5678876542344",
	"title": "Welcome to IIWBook",
	"description": "IIWBook facilitates connections between attendees by verifying attendance and distributing connection invitations.",
	"options": [
		{
		  "name": "obtain-email-cred",
		  "title": "Obtain a verified email credential",
		  "description": "Connect with the BC email verification service to obtain a verified email credential"
		},
		{
		  "name": "verify-email-cred",
		  "title": "Verify your participation",
		  "description": "Present a verified email credential to identify yourself"
		},
		{
		  "name": "search-introductions",
		  "title": "Search introductions",
		  "description": "Your email address must be verified to perform a search",
		  "disabled": true,
		  "form": {
			"title": "Search introductions",
			"description": "Enter a participant name below to perform a search.",
			"params": [
				{
					"name": "query",
					"title": "Participant name",
					"default": "",
					"description": "",
					"required": true,
					"type": "text"
				}
			],
			"submit-label": "Search"
		  }
		}
	]
};

var TEST_MENU_FORM = {
	"title": "Search introductions",
	"description": "Enter a participant name below to perform a search.",
	"params": [
		{
			"name": "query",
			"title": "Participant name",
			"default": "",
			"description": "",
			"required": true,
			"type": "text"
		}
	],
	"submit-label": "Search"
};


var app = new Vue({
	el: '#app-outer',
	data: {
		autoconnect: true,
		app_url: "http://agentbook.vonx.io:5000",
		app_label: '',
		app_endpoint: '',
		connections: [],
		conn_detail_id: null,
		conn_loading: false,
		conn_menu_closed: false,
		conn_menu_form: null,
		conn_status: null,
		conn_error: '',
		help_link: null,
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
			return formatDate(value);
		}
	},
	computed: {
		conn_detail() {
			if(this.conn_detail_id) {
				var found_idx = this.findConnection(this.conn_detail_id);
				if(found_idx !== null)
					return this.connections[found_idx];
			}
		},
		conn_menu() {
			return this.conn_detail && this.conn_detail.menu;
		},
		conn_groups() {
			var active = [], pending = [], inactive = [], conn;
			for(var idx = 0; idx < this.connections.length; idx ++) {
				conn = this.connections[idx];
				if(conn.state === "invitation") {
					pending.push(conn);
				}
				else if(conn.state === "inactive") {
					inactive.push(conn);
				}
				else {
					active.push(conn);
				}
			}
			var groups = [];
			if(active.length) {
				groups.push({
					name: "active",
					label: "Active Connections",
					connections: active
				});
			}
			if(inactive.length) {
				groups.push({
					name: "inactive",
					label: "Inactive Connections",
					connections: inactive
				});
			}
			if(pending.length) {
				groups.push({
					name: "pending",
					label: "Pending Connections",
					connections: pending
				});
			}
			return groups;
		}
	},
	methods: {
		showSettings() {
			this.mode = "settings";
		},
		showConnections(resync) {
			this.mode = "connections";
			if(! this.conn_status || resync === true)
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
					if(conn.activity[idx].type === 'message' && conn.activity[idx].direction === 'received') {
						conn.activity_count ++;
						if(conn.activity[idx].meta.copy_invite && ! conn.activity[idx].meta.copied) {
							conn.invite_count ++;
							conn.activity_count --;
						}
					}
				}
			}
			// conn.menu = TEST_MENU;
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
				heartbeat();
				self.receiveMessage(JSON.parse(event.data));
			}
			this.socket.onopen = function(event) {
				heartbeat();
				self.conn_error = null;
				self.fetchConnections();
			}
			this.socket.onerror = function(err) {
				self.conn_error = "Connection failed.";
				self.conn_loading = false;
				self.conn_status = false;
			}
			this.socket.onclose = function(err) {
				if(self.conn_status)
					self.conn_error = "Disconnected.";
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
				this.mergeConnection(msg.context.connection);
			}
			else if(msg.type == "settings") {
				this.app_label = msg.context.label;
				this.app_endpoint = msg.context.endpoint;
				this.help_link = msg.context.help_link;
				this.no_receive = !! msg.context.no_receive_invites;
				if(this.app_label)
					document.title = this.app_label;
			}
		},
		fetchConnections () {
			var self = this;
			if(this.mode == "connection_detail") {
				this.mode = "connections";
				this.conn_detail_id = null;
				this.conn_menu_form = null;
				this.conn_menu_closed = false;
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
					self.conn_loading = false;
					self.conn_status = true;
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
		},
		menuPerform (option_idx) {
			var menu = this.conn_menu;
			if(menu && menu.options && menu.options[option_idx]) {
				var opt = menu.options[option_idx];
				if(opt.form) {
					var form = Object.assign({}, opt.form);
					if(! form.title) form.title = opt.title;
					form.name = opt.name;
					form.values = {};
					for(var idx = 0; idx < form.params.length; idx ++) {
						if("default" in form.params[idx]) {
							form.values[form.params[idx].name] = form.params[idx]["default"];
						}
					}
					this.conn_menu_form = form;
					this.$nextTick(function() {
						var input = document.getElementById('menu-first-param');
						if(input) input.select();
					});
				} else {
					this.menuSubmit(opt.name);
				}
			}
		},
		menuSubmit (action_name, action_params) {
			var args = {
				name: action_name,
				params: action_params || {}
			};
			if(this.conn_detail) {
				var conn_id = this.conn_detail.connection_id;
				fetch(this.app_url + "/action-menu/" + conn_id + "/perform", {
					cache: "no-cache",
					headers: {
						"Content-Type": "application/json",
					},
					method: "POST",
					body: JSON.stringify(args)
				});
			}
		},
		menuSubmitForm () {
			if(this.conn_menu_form) {
				var params = this.conn_menu_form.values || {};
				this.menuSubmit(this.conn_menu_form.name, params);
			}
		},
		menuCloseForm () {
			this.conn_menu_form = null;
		},
		menuClose () {
			this.conn_menu_closed = true;
			/*if(this.conn_detail_id) {
				fetch(this.app_url + "/action-menu/" + this.conn_detail_id + "/close", {
					cache: "no-cache",
					method: "POST"
				});
			}*/
		},
		menuShow () {
			this.conn_menu_closed = false;
		}
	}
});

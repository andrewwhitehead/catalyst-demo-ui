
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
		app_url: "http://anywhy.ca:5000",
		app_label: '',
		app_endpoint: '',
		connections: [],
		conn_detail_id: null,
		conn_loading: false,
		conn_menu_closed: true,
		conn_menu_form: null,
		conn_status: null,
		conn_error: '',
		credentials: [],
		cred_detail_id: null,
		cred_loading: false,
		presentations: [],
		pres_detail_id: null,
		pres_loading: false,
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
				if(conn.state === "active") {
					active.push(conn);
				}
				else if(conn.state === "inactive") {
					inactive.push(conn);
				}
				else {
					pending.push(conn);
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
		},
		cred_groups() {
			var active = [], pending = [], cred;
			for(var idx = 0; idx < this.credentials.length; idx ++) {
				cred = this.credentials[idx];
				if(cred.state === "offer_received") {
					pending.push(cred);
				}
				else {
					active.push(cred);
				}
			}
			var groups = [];
			if(pending.length) {
				groups.push({
					name: "pending",
					label: "Pending Credential Offers",
					credentials: pending
				});
			}
			if(active.length) {
				groups.push({
					name: "active",
					label: "Received Credentials",
					credentials: active
				});
			}
			return groups;
		},
		cred_detail() {
			if(this.cred_detail_id) {
				var found_idx = this.findCredential(this.cred_detail_id);
				if(found_idx !== null)
					return this.credentials[found_idx];
			}
		},
		pres_groups() {
			var active = [], pending = [], pres;
			for(var idx = 0; idx < this.presentations.length; idx ++) {
				pres = this.presentations[idx];
				if(pres.state === "request_received") {
					pending.push(pres);
				}
				else {
					active.push(pres);
				}
			}
			var groups = [];
			if(pending.length) {
				groups.push({
					name: "pending",
					label: "Pending Presentation Requests",
					presentations: pending
				});
			}
			if(active.length) {
				groups.push({
					name: "active",
					label: "Completed Presentation Requests",
					presentations: active
				});
			}
			return groups;
		},
		pres_detail() {
			if(this.pres_detail_id) {
				var found_idx = this.findPresentation(this.pres_detail_id);
				if(found_idx !== null)
					return this.presentations[found_idx];
			}
		}
	},
	methods: {
		showSettings() {
			this.mode = "settings";
		},
		showConnections (resync) {
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
		removeConnection (conn_id) {
			var self = this;
			fetch(this.app_url + "/connections/" + conn_id + "/remove", {
				cache: "no-cache",
				method: "POST"
			}).then(function(response) {
				if(response.ok) {
					self.showConnections();
					self.fetchConnections();
				}
			});
		},
		resync (callback) {
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
				self.fetchConnections(callback);
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
			else if(msg.type === "connection_menu") {
				if(msg.context.connection_id == this.conn_detail_id) {
					this.updateConnection({
						connection_id: this.conn_detail_id,
						menu: msg.context.menu
					});
					console.log(this.conn_menu);
					console.log(this.conn_detail);
					this.conn_menu_closed = ! this.conn_menu;
					this.conn_menu_form = null;
				}
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
		fetchConnections (callback) {
			var self = this;
			if(this.mode == "connection_detail") {
				this.mode = "connections";
				this.conn_detail_id = null;
				this.conn_menu_form = null;
				this.conn_menu_closed = true;
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
					if(callback) callback();
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
		showCredentials (resync) {
			this.mode = "credentials";
			if(! this.conn_status || resync === true) {
				this.resync(this.fetchCredentials.bind(this));
			} else {
				this.fetchCredentials();
			}
		},
		fetchCredentials () {
			var self = this;
			fetch(this.app_url + "/credential_exchange", {
				cache: "no-cache",
				headers: {
					"Content-Type": "application/json",
				}
			}).then(function(response) {
				if(response.ok) response.json().then(function(data) {
					self.credentials = [];
					data.results.forEach(function(cred) {
						self.expandCredential(cred);
						self.credentials.push(cred);
					});
					console.log("credentials", data);
				});
			});
		},
		expandCredential (cred) {
			if(cred.connection_id && ! cred.image) {
				var image = new Identicon(cred.connection_id, { format: 'svg', size: 84 });
				var rgbColor = image.foreground;
				cred.color = formatColor(rgbColor);
				cred.image = 'data:image/svg+xml;base64,' + image.toString();
				if(cred.schema_id) {
					var parts = cred.schema_id.split(':');
					cred.issuer_did = parts[0];
					cred.schema_name = parts[2];
					cred.schema_version = parts[3];
				}
				var conn_idx = this.findConnection(cred.connection_id);
				if(conn_idx !== null) {
					cred.connection_label = this.connections[conn_idx].their_label;
				}
			}
		},
		acceptCredentialOffer (cred_id) {
			var self;
			fetch(this.app_url + "/credential_exchange/" + cred_id + "/send-request", {
				cache: "no-cache",
				method: "POST"
			}).then(function(response) {
				if(response.ok) response.json().then(function(data) {
					console.log("accepted credential offer:", data);
					self.fetchCredentials();
				});
			});
		},
		findCredential (cred_id) {
			for(var idx = 0; idx < this.credentials.length; idx ++) {
				if(this.credentials[idx].credential_exchange_id === cred_id)
					return idx;
			}
			return null;
		},
		showCredentialDetail (cred_id) {
			var found_idx = this.findCredential(cred_id);
			if(found_idx !== null) {
				this.cred_detail_id = cred_id;
				this.mode = "credential_detail";
				this.fetchCredentialDetail();
			}
		},
		fetchCredentialDetail () {
			var record = this.cred_detail;
			var self = this;
			if(record && record.credential_id) {
				this.cred_loading = true;
				fetch(this.app_url + "/credential/" + record.credential_id, {
					cache: "no-cache",
				}).then(function(response) {
					self.cred_loading = false;
					if(response.ok) response.json().then(function(data) {
						console.log("received credential:", data);
						var found_idx = self.findCredential(record.credential_exchange_id);
						var attrs = [];
						if(data.attrs) {
							for(var k in data.attrs) {
								attrs.push({name: k, value: data.attrs[k]});
							}
						}
						attrs.sort(function(a, b) { return a.name.localeCompare(b.name); });
						record.cred_attrs = attrs;
						if(found_idx !== null) {
							self.$set(self.credentials, found_idx, record);
						}
					});
				});
			}
		},
		removeCredential (cred_id) {
			var self = this;
			fetch(this.app_url + "/credential_exchange/" + cred_id + "/remove", {
				cache: "no-cache",
				method: "POST"
			}).then(function(response) {
				if(response.ok) {
					self.showCredentials();
					self.fetchCredentials();
				}
			});
		},
		showPresentations (resync) {
			this.mode = "presentations";
			if(! this.conn_status || resync === true) {
				this.resync(this.fetchPresentations.bind(this));
			} else {
				this.fetchPresentations();
			}
		},
		fetchPresentations () {
			var self = this;
			fetch(this.app_url + "/presentation_exchange", {
				cache: "no-cache",
				headers: {
					"Content-Type": "application/json",
				}
			}).then(function(response) {
				if(response.ok) response.json().then(function(data) {
					self.presentations = [];
					data.results.forEach(function(cred) {
						self.expandPresentation(cred);
						self.presentations.push(cred);
					});
					console.log("presentations", data);
				});
			});
		},
		expandPresentation (pres) {
			if(pres.connection_id && ! pres.image) {
				var image = new Identicon(pres.connection_id, { format: 'svg', size: 84 });
				var rgbColor = image.foreground;
				pres.color = formatColor(rgbColor);
				pres.image = 'data:image/svg+xml;base64,' + image.toString();
				var conn_idx = this.findConnection(pres.connection_id);
				if(conn_idx !== null) {
					pres.connection_label = this.connections[conn_idx].their_label;
					pres.connection_did = this.connections[conn_idx].their_did;
				}
			}
		},
		findPresentation (pres_id) {
			for(var idx = 0; idx < this.presentations.length; idx ++) {
				if(this.presentations[idx].presentation_exchange_id === pres_id)
					return idx;
			}
			return null;
		},
		preparePresentation (pres_id) {
			var found_idx = this.findPresentation(pres_id);
			if(found_idx !== null) {
				this.pres_detail_id = pres_id;
				this.mode = "presentation_prepare";
				this.fetchPresentationCreds();
			}
		},
		showPresentationDetail (pres_id) {
			var found_idx = this.findPresentation(pres_id);
			if(found_idx !== null) {
				this.pres_detail_id = pres_id;
				this.mode = "presentation_detail";
			}
		},
		fetchPresentationCreds () {
			var record = this.pres_detail;
			var self = this;
			if(record) {
				this.pres_loading = true;
				fetch(this.app_url + "/presentation_exchange/" + record.presentation_exchange_id + "/credentials", {
					cache: "no-cache",
				}).then(function(response) {
					self.pres_loading = false;
					if(response.ok) response.json().then(function(data) {
						console.log("received credentials:", data);
						var found_idx = self.findPresentation(record.presentation_exchange_id);
						record.cred_opts = self.expandPresentationOptions(record, data);
						if(found_idx !== null) {
							self.$set(self.presentations, found_idx, record);
						}
					});
				});
			}
		},
		expandPresentationOptions (record, creds) {
			var cred_opts = [];
			var attr_names = {};
			if(record.presentation_request) {
				var req_attrs = record.presentation_request.requested_attributes;
				for(var attr_id in req_attrs) {
					attr_names[attr_id] = req_attrs[attr_id].name;
				}
			}
			if(creds.attrs) {
				for(var attr_id in creds.attrs) {
					var attr_creds = creds.attrs[attr_id];
					if(attr_id in attr_names) {
						var attr_name = attr_names[attr_id];
						var opt = {
							id: attr_id,
							name: attr_name,
							options: [],
							selected: null,
						};
						for(var idx = 0; idx < attr_creds.length; idx++) {
							var attr_cred = attr_creds[idx].cred_info;
							var schema_id = attr_cred.schema_id.split(':');
							opt.options.push({
								id: attr_cred.referent,
								value: attr_cred.attrs[attr_name],
								schema_name: schema_id[2],
								schema_version: schema_id[3],
							});
							if(! opt.selected) opt.selected = attr_cred.referent;
						}
						cred_opts.push(opt);
					}
				}
			}
			return cred_opts;
		},
		submitPresentation () {
			var record = this.pres_detail;
			var self = this;
			if(record && record.cred_opts) {
				var attrs = {};
				for(var idx = 0; idx < record.cred_opts.length; idx++) {
					var opt = record.cred_opts[idx];
					attrs[opt.id] = {cred_id: opt.selected, revealed: true};
				}
				var request = {
					self_attested_attributes: {},
					requested_attributes: attrs,
					requested_predicates: {},
				};
				fetch(this.app_url + "/presentation_exchange/" + record.presentation_exchange_id + "/send_presentation", {
					cache: "no-cache",
					headers: {
						"Content-Type": "application/json",
					},
					method: "POST",
					body: JSON.stringify(request)
				}).then(function(response) {
					if(response.ok) response.json().then(function(data) {
						console.log("sent presentation:", data);
						self.showPresentations();
						var found_idx = self.findPresentation(record.presentation_exchange_id);
						if(found_idx !== null) {
							self.$set(self.presentations, found_idx, data);
						}
					});
				});
			}
		},
		menuPerform (option_idx) {
			var menu = this.conn_menu;
			if(menu && menu.options && menu.options[option_idx]) {
				var opt = menu.options[option_idx];
				console.log("menu perform:", opt.name);
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
		menuFetch () {
			if(this.conn_detail_id) {
				fetch(this.app_url + "/action-menu/" + this.conn_detail_id + "/fetch", {
					cache: "no-cache",
					method: "POST"
				}).then(function(response) {
					if(response.ok) response.json().then(function(data) {
						console.log("received menu:", data);
					});
				});
			}
		},
		menuCloseForm () {
			this.conn_menu_form = null;
		},
		menuClose () {
			this.conn_menu_closed = true;
			if(this.conn_detail_id) {
				fetch(this.app_url + "/action-menu/" + this.conn_detail_id + "/close", {
					cache: "no-cache",
					method: "POST"
				});
			}
		},
		menuShow () {
			if(this.conn_detail_id) {
				fetch(this.app_url + "/action-menu/" + this.conn_detail_id + "/request", {
					cache: "no-cache",
					method: "POST"
				});
			}
		}
	}
});

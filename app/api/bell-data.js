"use strict";
const fs = require('fs');
const utils = require('../utils.js');


// entire thing should be sync so that higher level abstractions can be async

class BellData {

	constructor(filename) {
		this.users = [];
		this.devices = [];
		this.hits = [];
		this.errors = [];
		this.filename = filename;

		try {
			let {users, devices, hits, errors} = JSON.parse(fs.readFileSync(this.filename).toString());
			this.users = users;
			this.devices = devices;
			this.hits = hits;
			this.errors = errors;

			// indexs arrays to make them much faster and easier to search
			this.user_index = {};
			for (let i = 0; i < this.users.length; i++) this.user_index[this.users[i].email] = i;

			this.devices_index = {};
			for (let i = 0; i < this.devices.length; i++) this.devices_index[this.devices[i].id] = i;

		} catch (e) {
			this.writeDataSync();
		}


	}

	// all the file system methods

	writeDataSync() {
		fs.writeFileSync(this.filename, this.getPreparedData());
	}

	writeDataAsync() {
		fs.writeFile(this.filename, this.getPreparedData(), err => {
			if (err) throw err;
		});
	}

	getPreparedData() {
		return JSON.stringify({
			users: this.users,
			devices: this.devices,
			hits: this.hits,
			errors: this.errors
		});
	}

	// helper methods

	getDeviceIndexByDeviceId(id) {

		if (typeof this.devices_index[id] === 'number') return this.devices_index[id];
		return false;

	}

	getUserIndexByEmail(email) {

		if (typeof this.user_index[email] === 'number') return this.user_index[email];
		return false;

	}

	getUserIndexByDeviceId(id) {
		let index = this.getDeviceIndexByDeviceId(id);

		if (index !== false && this.devices[index] && this.devices[index].registered_to) {
			index = this.getUserIndexByEmail(this.devices[index].registered_to);
			if (index !== false && this.users[index])
				return index;
		}

		return false;
	}

	// create user, devices, etc.
	// assumes that other code checks all params to make sure not undefined

	createNewUser(params) {
		let {email, first_name, last_name, profile_pic} = params;

		this.users.push({
			email,
			first_name,
			last_name,
			profile_pic,
			settings: {},
			stats: {
				created: Date.now()
			}
		});

		// adds this id to the index
		this.user_index[email] = this.users.length - 1;

		this.writeDataSync();

	}

	createNewDevice(params) {
		let {user_agent, browser, platform} = params;

		// creates id
		let id = utils.generateRandomID(10);

		this.devices.push({
			id,
			specs: {
				user_agent,
				browser,
				platform
			},
			date_registered: Date.now()
		});

		// adds this id to the index
		this.devices_index[id] = this.devices.length - 1;

		this.writeDataSync();

		return id;
	}

	// edit/augment user, devices, etc.

	registerDevice(id, email) {

		let index = this.getDeviceIndexByDeviceId(id);

		if (index !== false && this.devices[index] && this.devices[index].id === id)
			this.devices[index].registered_to = email;

		this.writeDataSync();

	}

	updatePeriodNames(device_id, values) {
		let index = this.getUserIndexByDeviceId(device_id);

		if (index !== false && this.users[index]) {

			let user = this.users[index];

			user.settings.period_names = values;

			this.writeDataSync();

			return {};
		}

		return { error: 'no_user_exists' };

	}

	updateUser(vals) {
		let index = this.getUserIndexByEmail(vals.email);

		if (index !== false && this.users[index]) {
			let user = this.users[index];

			user.first_name = vals.first_name;
			user.last_name = vals.last_name;
			user.profile_pic = vals.profile_pic;

			this.writeDataSync();
		}
	}

	// get user, devices, etc.

	getUserDataByEmail(email) {

		let index = this.getUserIndexByEmail(email);

		if (index !== false && this.users[index] && this.users[index].email === email)
			return this.users[index];

		return { error: 'no_user_exists' };
	}

	getUserDataByDeviceId(id) {

		let index = this.getDeviceIndexByDeviceId(id);

		if (index !== false && this.devices[index] && this.devices[index].id === id) {

			let cache = this.devices[index];

			if (cache.registered_to) {
				let res = this.getUserDataByEmail(cache.registered_to);
				if (res) return res;
			}

			return { registered: false }

		}

		return { error: 'no_user_exists' };

	}

	isThisMe(a, b) {

		for (let val of ['profile_pic', 'email', 'first_name', 'last_name'])
			if (a[val] !== b[val]) return false;
		return true;
	}

	// analytics

	recordHit(params) {

	}
}

module.exports = new BellData((process.env.NODE_ENV === 'production') ? '/home/centos/serve/data/bell_data.json' : './app/api/dev_data/bell_data.json');
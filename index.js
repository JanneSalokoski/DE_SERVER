const express = require('express');
const http = require('http');
const cors = require('cors');

const WebSocket = require('ws');

const nanoid = require('nanoid');

function readable_id() {
	const id = nanoid.customAlphabet('1234567890abcdef', 8)();
	const readable_id = `${id.slice(0, 4)}-${id.slice(4)}`
	return readable_id;
}

function main() {
	const app = express();
	app.use(cors());
	app.use(express.json());

	const server = http.createServer(app);
	//const port = 3000;

	const wss = new WebSocket.Server({ server });

	let state = {
		election_status: 'not running',
		host: undefined,
		unverified_voters: [],
		verified_voters: [],

		connections: {},
	};

	function new_connection_handler(connection_type, websocket) {
		const connection_id = readable_id();
		state.connections[connection_id] = {
			type: connection_type,
			socket: websocket,
			clients: [],
			candidates: [],
			election_status: false,
			election_results: {},
			unverified_voters: [],
			verified_voters: [],
			votes: [],
		};

		state.connections[connection_id].socket.send(JSON.stringify({
			type: 'accept_connection',
			payload: {
				connection_id: connection_id,
				connected: true,	
			}
		}));
	}

	function register_candidate_handler(candidate, connection) {
		state.connections[connection].candidates.push({
			id: readable_id(),
			name: candidate.name,
			list: candidate.list !== '' ? candidate.list : candidate.name
		});

		console.log(candidate);

		state.connections[connection].socket
			.send(JSON.stringify({
				type: 'update_candidates',
				payload: {
					candidates: state.connections[connection].candidates
				}	
			}));
	}


	function register_client_handler(payload, connection) {
		if (state.connections[payload.host]) {
			state.connections[payload.host].clients.push(connection);
			state.connections[connection].host = payload.host;
			state.connections[connection].socket.send(JSON.stringify({
				type: 'accept_registration',
				payload: {
					hostID: payload.host,
					accepted: true
				}
			}));
		}
		else {
			state.connections[connection].socket.send(JSON.stringify({
				type: 'accept_registration',
				payload: {
					hostID: payload.host,
					accepted: false
				}
			}));
		}
	}

	function register_voter_handler(payload, connection) {
		state.connections[state.connections[connection].host].unverified_voters.push({
			id: connection,
			name: payload.name
		});

		state.connections[state.connections[connection].host].socket.send(JSON.stringify({
			type: 'update_voters',
			payload: {
				unverified_voters: state.connections[state.connections[connection].host].unverified_voters,
				verified_voters: state.connections[state.connections[connection].host].verified_voters
			}
		}));
	}	

	function verify_voter_handler(payload, connection) {
		let unverified_voters = [...state.connections[connection].unverified_voters];
		let verified_voters = [...state.connections[connection].verified_voters];

		unverified_voters = unverified_voters.filter(voter => voter.id !== payload.id);
		verified_voters.push(payload);

		state.connections[connection].unverified_voters = unverified_voters;
		state.connections[connection].verified_voters = verified_voters;

		state.connections[connection].socket.send(JSON.stringify({
			type: 'update_voters',
			payload: {
				unverified_voters: state.connections[connection].unverified_voters,
				verified_voters: state.connections[connection].verified_voters
			}
		}));

		state.connections[payload.id].socket.send(JSON.stringify({
			type: 'accept_voter_registration',
			payload: {verified: true}
		}));
	}

	function unverify_voter_handler(payload, connection) {
		let unverified_voters = [...state.connections[connection].unverified_voters];
		let verified_voters = [...state.connections[connection].verified_voters];

		verified_voters = verified_voters.filter(voter => voter.id !== payload.id);
		unverified_voters.push(payload);

		state.connections[connection].unverified_voters = unverified_voters;
		state.connections[connection].verified_voters = verified_voters;

		state.connections[connection].socket.send(JSON.stringify({
			type: 'update_voters',
			payload: {
				unverified_voters: state.connections[connection].unverified_voters,
				verified_voters: state.connections[connection].verified_voters
			}
		}));

		state.connections[payload.id].socket.send(JSON.stringify({
			type: 'accept_voter_registration',
			payload: {verified: false}
		}));
	}

	function vote_handler(payload, connection) {
		state.connections[state.connections[connection].host].votes.push({
			vote_id: payload.vote_id,
			candidate_id: payload.candidate_id
		});	

		state.connections[connection].socket.send(JSON.stringify({
			type: 'accept_vote',
			payload: {accepted: true}
		}));

		state.connections[state.connections[connection].host].socket.send(JSON.stringify({
			type: 'update_vote_count',
			payload: {
				vote_count: state.connections[state.connections[connection].host].votes.length
			}
		}));
	}

	function start_election_handler(payload, connection) {
		state.connections[connection].election_status = true;

		state.connections[connection].socket.send(JSON.stringify({
			type: 'update_election_status',
			payload: {
				election_status: true
			}
		}));

		state.connections[connection].clients.map(client => {
			state.connections[client].socket.send(JSON.stringify({
				type: 'update_election_status',
				payload: {
					election_status: true
				}
			}));

			state.connections[client].socket.send(JSON.stringify({
				type: 'update_candidates',
				payload: {
					candidates: state.connections[connection].candidates
				}
			}));
		})
	}

	function getRandomIntInclusive(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1) + min); //The maximum is inclusive and the minimum is inclusive 
}

function vote_sort(a, b) {
	if (a.votes < b.votes) {
		return -1;
	}
	else if (a.votes > b.votes) {
		return 1;
	}

	return getRandomIntInclusive(0, 1) ? -1 : 1;
}

function compare_sort(a, b) {
	if (a.compare_number > b.compare_number) {
		return -1;
	}
	else if (a.compare_number < b.compare_number) {
		return 1;
	}

	return getRandomIntInclusive(0, 1) ? -1 : 1;
}

function get_election_results(candidates, votes) {
	const election_list_names = Array.from(
		new Set(candidates.map(candidate => candidate.list))
	);
	
	let election_lists = election_list_names.map(list_name => ({
		name: list_name,

		compare_number: candidates
			.map(candidate => ({ ...candidate, votes: (votes.filter(vote => vote.candidate_id === candidate.id)).length }))
			.filter(candidate => candidate.list === list_name)
			.map(candidate => candidate.votes)
			.reduce((acc, curr) => acc + curr),

		candidates: candidates
			.filter(candidate => candidate.list === list_name)
			.map(candidate => ({ ...candidate, votes: (votes.filter(vote => vote.candidate_id === candidate.id)).length }))
			.sort(vote_sort)
	}));

	election_lists = election_lists.map(election_list => ({
		...election_list,
		candidates: election_list.candidates
			.map(candidate => ({
				...candidate,
				compare_number: election_list.compare_number / (election_list.candidates.length - election_list.candidates.indexOf(candidate))
		})).sort(compare_sort)
	}));

	return {
		candidates: election_lists
			.map(list => list.candidates)
			.flat()
			.sort(compare_sort),

		votes: votes
	}
}

	function end_election_handler(payload, connection) {
		state.connections[connection].election_status = false;
		state.connections[connection].election_results = get_election_results([...state.connections[connection].candidates], [...state.connections[connection].votes]);

		state.connections[connection].socket.send(JSON.stringify({
			type: 'update_election_status',
			payload: {
				election_status: false
			}
		}));

		state.connections[connection].socket.send(JSON.stringify({
			type: 'update_election_results',
			payload: {
				election_results: state.connections[connection].election_results
			}
		}));

		state.connections[connection].socket.send(JSON.stringify({
			type: 'update_candidates',
			payload: {
				candidates: []
			}
		}));

		state.connections[connection].socket.send(JSON.stringify({
			type: 'update_voters',
			payload: {
				unverified_voters: [],
				verified_voters: []
			}
		}));

		state.connections[connection].unverified_voters = [];
		state.connections[connection].verified_voters = [];

		state.connections[connection].clients.map(client => {
			state.connections[client].socket.send(JSON.stringify({
				type: 'update_election_status',
				payload: {
					election_status: false
				}
			}));
		})
	}

	wss.on('connection', (ws) => {
		const ws_action_handlers = {
			connect: (payload) => new_connection_handler(payload.connection_type, ws),	
			register_candidate: register_candidate_handler,

			register_client: register_client_handler,
			register_voter: register_voter_handler,

			verify_voter: verify_voter_handler,
			unverify_voter: unverify_voter_handler,

			start_election: start_election_handler,
			end_election: end_election_handler,

			send_vote: vote_handler,
		};

		ws.on('message', (message) => {
			const action = JSON.parse(message);
			console.log('Action: ', action);
			ws_action_handlers[action.type](action.payload, action.connection);
		});
	});

	let port = process.env.PORT;
	if (port == null || port == "") {
	  port = 8000;
	}
	server.listen(port, () => {
		console.log('Server running.')
	});
}

main();
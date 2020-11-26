const nanoid = require('nanoid');

function readable_id() {
	const id = nanoid.customAlphabet('1234567890abcdef', 8)();
	const readable_id = `${id.slice(0, 4)}-${id.slice(4)}`
	return readable_id;
}

const candidates = [
  { id: readable_id(), name: 'Janne Salokoski', list: 'Osakuntalaiset' },
  { id: readable_id(), name: 'Jalmari Salovirta', list: 'Osakuntalaiset' },
  { id: readable_id(), name: 'Roni Vatto', list: 'Osakuntalaiset' },
  { id: readable_id(), name: 'Esa-Pekka Helanne', list: 'Osakuntalaiset' },
  { id: readable_id(), name: 'Jori Vismanen', list: 'HYAL' },
  { id: readable_id(), name: 'Salli Ahtiainen-Helanne', list: 'HYAL' },
];

function getRandomIntInclusive(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1) + min); //The maximum is inclusive and the minimum is inclusive 
}

const votes = [
	{ vote_id: readable_id(), candidate_id: candidates[getRandomIntInclusive(0, candidates.length - 1)].id },
	{ vote_id: readable_id(), candidate_id: candidates[getRandomIntInclusive(0, candidates.length - 1)].id },
	{ vote_id: readable_id(), candidate_id: candidates[getRandomIntInclusive(0, candidates.length - 1)].id },
	{ vote_id: readable_id(), candidate_id: candidates[getRandomIntInclusive(0, candidates.length - 1)].id },
	{ vote_id: readable_id(), candidate_id: candidates[getRandomIntInclusive(0, candidates.length - 1)].id },
	{ vote_id: readable_id(), candidate_id: candidates[getRandomIntInclusive(0, candidates.length - 1)].id },
	{ vote_id: readable_id(), candidate_id: candidates[getRandomIntInclusive(0, candidates.length - 1)].id },
	{ vote_id: readable_id(), candidate_id: candidates[getRandomIntInclusive(0, candidates.length - 1)].id },
	{ vote_id: readable_id(), candidate_id: candidates[getRandomIntInclusive(0, candidates.length - 1)].id },
	{ vote_id: readable_id(), candidate_id: candidates[getRandomIntInclusive(0, candidates.length - 1)].id },
	{ vote_id: readable_id(), candidate_id: candidates[getRandomIntInclusive(0, candidates.length - 1)].id },
];

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

const results = get_election_results(candidates, votes);
console.log(results);

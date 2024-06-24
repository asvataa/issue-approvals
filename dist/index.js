/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 378:
/***/ ((module) => {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 113:
/***/ ((module) => {

module.exports = eval("require")("@actions/github");


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
const core = __nccwpck_require__(378);
const github = __nccwpck_require__(113);

async function run() {
  try {
    const issueNumber = core.getInput('issue_number', { required: true });
    const token = core.getInput('github_token', { required: true });
    const minApprovals = parseInt(core.getInput('min_approvals', { required: true }));
    const deployedLabel = core.getInput('deployed_label', { required: true });
    const superUsers = core.getInput('super_users', { required: true }).split(',').map(user => user.trim());
    const groupNames = core.getInput('groups', { required: true }).split(',').map(group => group.trim());

    const octokit = github.getOctokit(token);

    const { data: issue } = await octokit.rest.issues.get({
      ...github.context.repo,
      issue_number: issueNumber,
    });

    if (issue.labels.some(label => label.name === deployedLabel)) {
      core.setFailed(`Issue already has the '${deployedLabel}' label.`);
      return;
    }

    const comments = await octokit.rest.issues.listComments({
      ...github.context.repo,
      issue_number: issueNumber,
    });

    const approvalWords = ["yes", "ok", "approved"];
    const approvedComments = comments.data.filter(comment =>
      approvalWords.some(word => comment.body.toLowerCase().includes(word))
    );

    let allApproved = approvedComments.some(comment => superUsers.includes(comment.user.login));

    const unapprovedGroups = [];
    if (!allApproved) {
      for (const group of groupNames) {
        const { data: groupMembers } = await octokit.rest.teams.listMembersInOrg({
          org: github.context.repo.owner,
          team_slug: group,
        });

        const approvedMembers = approvedComments.map(comment => comment.user.login);
        const groupApproved = groupMembers.some(member => approvedMembers.includes(member.login));

        if (!groupApproved) {
          unapprovedGroups.push(group);
        }
      }

      allApproved = unapprovedGroups.length === 0;
    }

    if (!allApproved) {
      const taggedGroups = unapprovedGroups.map(group => `@${group}`).join(' ');
      const commentBody = `Not enough approvals. Need attention from groups: ${taggedGroups}`;
      await octokit.rest.issues.createComment({
        ...github.context.repo,
        issue_number: issueNumber,
        body: commentBody
      });

      if (issue.state === 'closed') {
        await octokit.rest.issues.update({
          ...github.context.repo,
          issue_number: issueNumber,
          state: 'open'
        });
      }
    }

    core.setOutput('all_approved', allApproved);
  } catch (error) {
    core.setFailed(`Error in action: ${error.message}`);
  }
}

run();
})();

module.exports = __webpack_exports__;
/******/ })()
;
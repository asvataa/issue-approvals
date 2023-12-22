const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  try {
    const issueNumber = core.getInput('issue_number', { required: true });
    const token = core.getInput('github_token', { required: true });
    const minApprovals = parseInt(core.getInput('min_approvals', { required: true }));
    const deployedLabel = core.getInput('deployed_label', { required: true });
    const superUsers = core.getInput('super_users', { required: true }).split(',').map(user => user.trim());

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

    const unapprovedAssignees = [];
    if (!allApproved) {
      const assignees = issue.assignees.map(assignee => assignee.login);
      const approvedAssignees = approvedComments.map(comment => comment.user.login);
      const approvalCount = assignees.filter(assignee => {
        const isApproved = approvedAssignees.includes(assignee);
        if (!isApproved) {
          unapprovedAssignees.push(assignee);
        }
        return isApproved;
      }).length;

      allApproved = approvalCount >= minApprovals;
    }

    if (!allApproved) {
      const taggedUsers = unapprovedAssignees.map(user => `@${user}`).join(' ');
      const commentBody = `Not enough approvals. Need attention from: ${taggedUsers}`;
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
const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  try {
    const issueNumber = core.getInput('issue_number', { required: true });
    const token = core.getInput('github_token', { required: true });
    const minApprovals = parseInt(core.getInput('min_approvals', { required: true }));
    const deployedLabel = core.getInput('deployed_label', { required: true });
    const superUser = core.getInput('super_user', { required: true });

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

    const assignees = issue.assignees.map(assignee => assignee.login);
    const approvalWords = ["yes", "ok", "approved"];

    const approvedAssignees = comments.data.filter(comment =>
      approvalWords.some(word => comment.body.toLowerCase().includes(word))
    ).map(comment => comment.user.login);

    let allApproved = false;
    let approvalCount = assignees.filter(assignee => approvedAssignees.includes(assignee)).length;

    if (approvedAssignees.includes(superUser)) {
      allApproved = true;
      approvalCount = assignees.length;
    } else {
      allApproved = approvalCount >= minApprovals;
    }

    core.setOutput('all_approved', allApproved);
    core.setOutput('approval_count', approvalCount);
  } catch (error) {
    core.setFailed(`Error in action: ${error.message}`);
  }
}

run();

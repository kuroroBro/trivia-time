export function reconcileDraft({ questionId, draftQuestionId, answerDraft, serverAnswer, locked }) {
  const questionChanged = draftQuestionId !== questionId;
  if (questionChanged) {
    const nextDraft = serverAnswer || "";
    return { draftQuestionId: questionId, answerDraft: nextDraft, shouldWrite: true, shouldFocus: !locked };
  }
  if (locked) {
    return { draftQuestionId, answerDraft: serverAnswer || answerDraft, shouldWrite: true, shouldFocus: false };
  }
  return { draftQuestionId, answerDraft, shouldWrite: false, shouldFocus: false };
}

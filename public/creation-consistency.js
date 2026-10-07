/* Approved phone Review action, retaining the series clearing handler. */
(function(){
const CLEAR=String.raw`
    <div id="groupsReviewActions"><button type="button" id="groupsReviewClear">Clear Selection</button></div>
`;
const original=renderReviewRail;
renderReviewRail=function(){
 original.apply(this,arguments);
 if(!matchMedia('(max-width:767px)').matches)return;
 document.getElementById('groupsReviewActions')?.remove();
 reviewView.insertAdjacentHTML('beforeend',CLEAR);
 document.getElementById('reviewGrid').before(document.getElementById('groupsReviewActions'));
 document.getElementById('groupsReviewClear').addEventListener('click',askStartOver);
};
})();

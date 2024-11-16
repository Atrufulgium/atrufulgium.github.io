var postsByTag; // filled in by jekyll on the main html page

let currentFilter = new Set()

let allPostsElement;
let buttonContainer;

window.addEventListener("DOMContentLoaded", function(event) {
    allPostsElement = document.getElementById("all-posts");
    buttonContainer = document.getElementById("buttons-here");
    addButtons();
});


function resetFilter() {
    currentFilter = new Set()
    updateButtons();
    applyFilter();
}

function toggleFilter(tag) {
    if (currentFilter.has(tag)) {
        currentFilter.delete(tag);
    } else {
        currentFilter.add(tag);
    }
    updateButtons();
    applyFilter();
}

function applyFilter() {
    for (const post of allPostsElement.children) {
        let id = post.id;
        
        post.style.display = idSurvivesFilter(id, currentFilter)
            ? "initial" : "none";
    }
}

function updateButtons() {
    for (const button of buttonContainer.getElementsByClassName("button")) {
        let tag = button.id.substring(0, button.id.length - 7); // minus "-button"

        // Easy part: update styling
        if (currentFilter.has(tag)) {
            if (!button.classList.contains("buttonenabled"))
                button.classList.add("buttonenabled");
        } else {
            if (button.classList.contains("buttonenabled"))
                button.classList.remove("buttonenabled");
        }

        // Annoying part: helpful numbers
        // For every button, list how many match the current filter plus that
        // extra tag. Yes this is the O(ew) implementation, and literally
        // copies applyFilter(), but I don't care.

        let extraFilter = new Set(currentFilter);
        extraFilter.add(tag);
        let match = 0;
        for (const post of allPostsElement.children) {
            if (idSurvivesFilter(post.id, extraFilter))
                match++;
        }

        if (match === 0)
            button.classList.add("buttondisabled");
        else
            button.classList.remove("buttondisabled");

        // The tag is stored in a <span class="count">-child.
        for (const child of button.getElementsByClassName("count")) {
            child.innerText = match;
        }
    }
}

function idSurvivesFilter(id, filter) {
    let matchesAll = true;
        
    for (const tag of filter) {
        let tagPosts = postsByTag[tag];
        let found = false;
        for (const tagPost of tagPosts) {
            if (tagPost["url"] === id) {
                found = true;
                break;
            }
        }
        matchesAll &&= found;
        if (!matchesAll)
            break;
    }

    return matchesAll;
}

// Adds and enables all filter buttons
function addButtons() {
    document.getElementById("filter").style.display = "initial";

    let tags = []
    for (const tag in postsByTag) {
        tags.push([tag, postsByTag[tag].length]);
    }
    tags.sort((a,b) => b[1] - a[1]);

    for (const tag of tags) {
        let ele = document.createElement("button");
        ele.className = "button";
        ele.id = tag[0] + "-button";
        ele.innerHTML = tag[0] + ` (<span class="count">` + tag[1] + "</span>)";
        ele.onclick = function() { toggleFilter(tag[0]) }
        ele.style.marginRight = "5px";
        buttonContainer.appendChild(ele);
    }
}
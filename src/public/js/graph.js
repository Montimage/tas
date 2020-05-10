var cy = window.cy = cytoscape({
    container: document.getElementById('cy'),

    boxSelectionEnabled: false,
    autounselectify: true,

    maxZoom: 6,
    minZoom: 0.4,

    style: [{
            selector: 'node',
            css: {
                'content': 'data(id)',
                'background-fit': 'contain',
                'background-image-opacity': '0.3',
                'text-valign': 'center',
                'text-halign': 'center',
                'font-size': '4px',
                'font-weight': 'bold'
            }
        },
        {
            selector: 'node.container',
            css: {
                'padding-top': '10px',
                'padding-left': '10px',
                'padding-bottom': '10px',
                'padding-right': '10px',
                'text-valign': 'top',
                'text-halign': 'center',
                'background-color': '#DDD',
                'font-size': '8px',
                'font-weight': 'normal',
                'shape': 'rectangle',
                'background-image': './img/docker-official.svg'
            }
        },
        {
            selector: 'edge',
            css: {
                'curve-style': 'bezier',
                'target-arrow-shape': 'triangle'
            }
        }, {
            selector: 'edge.control',
            css: {
                'curve-style': 'bezier',
                'target-arrow-shape': 'circle'
            }
        },
        {
            selector: ':selected',
            css: {
                'background-color': 'black',
                'line-color': 'black',
                'target-arrow-color': 'black',
                'source-arrow-color': 'black'
            }
        }, {
            selector: 'node.questionable',
            css: {
                'border-color': '#A33',
                'background-color': '#B55',
                'shape': 'roundrectangle'
            }
        }, {
            selector: 'node.node_red',
            css: {
                'background-image': './img/node-red-256.png',
            }
        }, {
            selector: 'node.ansible',
            css: {
                'background-image': './img/ansible.png',
            }
        },{
            selector: 'node.orion',
            css: {
                'background-color': '#ADD8E6',
                'background-image': './img/fiware_logo.png',
            }
        },{
            selector: 'node.thingml',
            css: {
                'background-color': '#ADD8E6',
                'background-image': './img/thingml_short.png',
            }
        },{
            selector: 'node.device',
            css: {
                'padding-top': '10px',
                'padding-left': '10px',
                'padding-bottom': '10px',
                'padding-right': '10px',
                'text-valign': 'top',
                'text-halign': 'center',
                'background-color': '#DDD',
                'font-size': '8px',
                'font-weight': 'normal',
                'shape': 'rectangle',
                'background-image': './img/device.png'
            }
        }, {
            selector: 'node.vm',
            css: {
                'padding-top': '10px',
                'padding-left': '10px',
                'padding-bottom': '10px',
                'padding-right': '10px',
                'text-valign': 'top',
                'text-halign': 'center',
                'background-color': '#DDD',
                'font-size': '8px',
                'font-weight': 'normal',
                'shape': 'rectangle',
                'background-image': './img/server_cloud.png'
            }
        }
    ],

    elements: {
        nodes: [],
        edges: []
    },

    layout: {
        name: 'preset',
        padding: 5
    }

});

var d_m;

cy.on('cxttap', 'node', function (evt) {
    var target_node = evt.target;
    d_m = window.SiderDemo.getDM();
    var elem = d_m.find_node_named(target_node.id());
    window.DrawerEdit.showDrawer(target_node, elem);
    //window.FormEdit.build_form(elem);
});

cy.on('cxttap', 'edge', function (evt) {
    var target_link = evt.target;
    d_m = window.SiderDemo.getDM();
    var elem = d_m.find_link_named(target_link.id());
    window.EditLink.showDrawer(target_link, elem);
});

cy.on("viewport", onViewport);

function onViewport(e) {
    let zoomFactor = cy.zoom();
    let defaultZoom = 2;
    document.getElementById("cy").style.backgroundSize = defaultZoom * zoomFactor + "vh " + defaultZoom * zoomFactor + "vh";

    let panPos = cy.pan();
    document.getElementById("cy").style.backgroundPosition = panPos.x + "px " + panPos.y + "px";
}


var graph_factory = function (name) {
    //var name = $("#ctx_name").val();

    var node = { // Add to the display
        group: "nodes", //we need a factory for this.
        data: {
            id: name
        },
        position: {
            x: 200,
            y: 200
        }
    };


    this.create_edge = function (type) {
        if (type === 'control') {
            edge.classes = 'control';
        }
        return edge;
    }

    this.create_node = function (type) {
        if (type === "external_host") {
            node.classes = 'container';
        } else if (type === "/infra/vm_host") {
            node.classes = 'vm';
        } else if (type === "/infra/docker_host") {
            node.classes = 'container';
        } else if (type === "/external") {

        } else if (type === "/internal/node_red") {
            node.classes = 'node_red';
        } else if (type === "/internal") {

        } else if (type === "/infra/device") {
            node.classes = 'device';
        } else if (type === 'ansible') {
            node.classes = 'ansible';
        } else if (type === '/internal/orion') {
            node.classes = 'orion';
        } else if (type === '/internal/thingml') {
            node.classes = 'thingml';
        }
        return node;
    }

    return this;
};
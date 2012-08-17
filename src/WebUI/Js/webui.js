(function(jQuery)
{

var WebUI = 
{
    "torrents": {},
    "peerlist": {},
    "filelist": {},
    "settings": {},
    "props": {},
    
    "categories":
    {
        "cat_all": 0,
        "cat_dls": 0,
        "cat_com": 0,
        "cat_act": 0,
        "cat_iac": 0,
        "cat_nlb": 0,
    },
    
    "labels": {},
    
    "limits":
    {
        "reqRetryDelayBase": 2, // seconds
        "reqRetryMaxAttempts": 5,
        "minTableRows": 5,
        "maxVirtTableRows": Math.ceil(screen.height / 16) || 100,
        "minUpdateInterval": 500,
        "minDirListCache": 30, // seconds
        "minFileListCache": 60, // seconds
        "minPeerListCache": 5, // seconds
        "minXferHistCache": 60, // seconds
        "defHSplit": 140,
        "defVSplit": 225,
        "minHSplit": 25,
        "minVSplit": 150,
        "minTrtH": 100,
        "minTrtW": 150
    },
    "defConfig":
    {
        "showDetails": true,
        "showDetailsIcons": true,
        "showCategories": true,
        "showToolbar": true,
        "showStatusBar": true,
        "showSpeedGraph": true,
        "useSysFont": true,
        "updateInterval": 3000,
        "maxRows": 0,
        "lang": "en",
        "hSplit": -1,
        "vSplit": -1,
        "torrentTable":
        {
            "colMask": 0x0000, // automatically calculated based on this.trtColDefs
            "colOrder": [], // automatically calculated based on this.trtColDefs
            "colWidth": [], // automatically calculated based on this.trtColDefs
            "reverse": false,
            "sIndex": -1
        }
    },
    
    //"spdGraph": new SpeedGraph(),
    
    "trtTable": new STable(),
    "trtColDefs":
    [
        //[ colID, colWidth, colType, colDisabled = false, colIcon = false, colAlign = ALIGN_AUTO, colText = "" ]
          ["name", 220, TYPE_STRING]
        , ["order", 35, TYPE_NUM_ORDER]
        , ["size", 75, TYPE_NUMBER]
        , ["remaining", 90, TYPE_NUMBER, true]
        , ["done", 60, TYPE_NUM_PROGRESS]
        , ["status", 100, TYPE_CUSTOM]
        , ["seeds", 60, TYPE_NUMBER]
        , ["peers", 60, TYPE_NUMBER]
        , ["seeds_peers", 80, TYPE_NUMBER, true]
        , ["downspeed", 80, TYPE_NUMBER]
        , ["upspeed", 80, TYPE_NUMBER]
        , ["eta", 60, TYPE_NUM_ORDER]
        , ["uploaded", 75, TYPE_NUMBER, true]
        , ["downloaded", 75, TYPE_NUMBER, true]
        , ["ratio", 50, TYPE_NUMBER]
        , ["availability", 50, TYPE_NUMBER]
        , ["label", 80, TYPE_STRING, true]
        , ["added", 150, TYPE_NUMBER, true, false, ALIGN_LEFT]
        , ["completed", 150, TYPE_NUMBER, true, false, ALIGN_LEFT]
        , ["url", 250, TYPE_STRING, true]
    ],
    
    "init": function()
    {
        this.config = Object.merge({}, this.defConfig);
        this.config.lang = "";
        
        this.trtColDoneIdx = this.trtColDefs.map(function(item) { return item[0] == "done"; }).indexOf(true);
        this.trtColStatusIdx = this.trtColDefs.map(function(item) { return item[0] == "status"; }).indexOf(true);
        
        // file prio
        //this.flsColPrioIdx = this.flsColDefs.map(function(item) { return item[0] == "prio"; }).indexOf(true);
        
        // default col mask
        this.trtColDefs.each(function(item, index) { this.trtColToggle(index, item[3], true); }, this);
        
        if(window.hdknweb) return;
        
        this.getSettings((function()
        {
            this.update.delay(0, this, (function()
            {
                this.refreshSelectedTorGroups();
                this.hideMsg();
            }).bind(this));
        }).bind(this));
    },
    
    "trtFormatRow": function(values, index)
    {
        var useidx = $chk(index);
        
        if(useidx)
        {
            return values[index];
        }
        else
        {
            return values;
        }
    },
    
    "trtSortCustom": function(col, dataX, dataY)
    {
        var ret = 0;
        
        return ret;
    },
    
    "trtSelect": function(ev, id)
    {
    },
    
    "trtDblClick": function(id)
    {
    },
    
    "trtColReset": function()
    {
    },
    
    "trtSort": function(index, reverse)
    {
    },
    
    "trtColMove": function()
    {
    },
    
    "trtColResize": function()
    {
    },
    
    "trtColToggle": function()
    {
    },
    
    "hideMsg": function()
    {
        $("cover").hide();
    },
    
    "beginPeriodicUpdate": function(delay)
    {
        this.endPeriodicUpdate();
        
        delay = parseInt(delay, 10);
        if(isNaN(delay)) delay = this.config.updateInterval;
        
        this.config.updateInterval = delay = delay.max(this.limits.minUpdateInterval);
        this.updateTimeout = this.update.delay(delay, this);
    },
    
    "endPeriodicUpdate": function()
    {
        clearTimeout(this.updateTimeout);
        clearInterval(this.updateTimeout);
    },
    
    "request": function(method, url, fn, async, fails)
    {
        if(typeOf(fails) != "array") fails = [0];
        
        var self = this;
        var really_async = true;
        
        if(really_async !== undefined)
        {
            really_async = async;
        }
        
        var req = function()
        {
            try
            {
                new Request.JSON({
                    "url": url,
                    "method": method,
                    "async": typeof(async) === "undefined" || !!async,
                    "onFailure": function()
                    {
                        self.endPeriodicUpdate();
                        
                        fails[0]++;
                        
                        var delay = Math.pow(self.limits.reqRetryDelayBase, fails[0]);
                        
                        if(fails[0] <= self.limits.reqRetryMaxAttempts)
                        {
                            log("Request failure #" + fails[0] + " (will retry in " + delay + " seconds): " + url);
                        }
                        else
                        {
                            window.removeEvents("unload");
                            
                            self.showMsg(
                                "<p>Cannot connect to Hadouken</p>" +
                                '<p>Try <a href="javascript:void(0);" onclick="window.location.reload(true);">reloading</a> the page</p>'
                            );
                            
                            return;
                        }
                        
                        self.request.delay(delay * 1000, self, [ url, function(json)
                        {
                            if(fails[0])
                            {
                                fails[0] = 0;
                                
                                log("Request retry succeeded: " + url);
                                if(fn) fn.delay(0, self, json);
                                self.beginPeriodicUpdate();
                            }
                        }, async, fails ]);
                    },
                    "onSuccess": (fn) ? fn.bind(self) : Function.from()
                }).send();
            }
            catch(e)
            {
                console.log(e);
            }
        };
        
        req();
    },
    
    "update": function(listcb)
    {
        if(window.hdknweb !== undefined) return;
        
        this.totalDL = 0;
        this.totalUL = 0;
        
        this.getList(null, (function()
        {
            // TODO: uncomment when implementing speed graph
            // this.spdGraph.addData(this.totalUL, this.totalDL);
            
            this.showDetails();
            
            this.updateTitle();
            this.updateToolbar();
            this.updateStatusBar();
            
            if(typeof(listcb) === "function") listcb();
        }).bind(this));
        
        if(typeof(DialogManager) !== "undefined")
        {
            if(DialogManager.showing.contains("Settings") && ("dlgSettings-TransferCap" == this.stpanes.active))
            {
                this.getTransferHistory();
            }
        }
    },
    
    "getList": function(url, fn)
    {
        this.endPeriodicUpdate();
        
        this.request("get", "/api/torrents", (function(json)
        {
            this.loadList(json);
            if(fn) fn(json);
        }).bind(this));
    },
    
    "loadList": function(json)
    {
        function extractLists(fullListName, changedListName, removedListName, key, exList)
        {
            var extracted = { hasChanged: false };
            
            if(!has(json, fullListName))
            {
                if(!has(json, changedListName))
                {
                    extracted[fullListName] = extracted[removedListName] = [];
                    extracted.hasChanged = false;
                }
                else
                {
                    extracted[fullListName] = json[changedListName];
                    delete json[changedListName];
                    
                    extracted[removedListName] = json[removedListName];
                    delete json[removedListName];
                    
                    extracted.hasChanged = ((extracted[fullListName].length + extracted[removedListName].length) > 0);
                }
            }
            else
            {
                extracted.hasChanged = true;
                
                var list = extracted[fullListName] = json[fullListName];
                delete json[fullListName];
                
                var removed = extracted[removedListName] = [];
                
                var exKeys = {};
                for(var k in exList)
                {
                    exKeys[k] = 1;
                }
                
                for(var i = 0, len = list.length; i < len; i++)
                {
                    if(has(exKeys, list[i][key])) delete exKeys[list[i][key]];
                }
                
                for(var k in exKeys)
                {
                    removed.push(k);
                }
            }
            
            return extracted;
        }
        
        if(!json.labels)
        {
            this.loadLabels(Array.clone([]));
        }
        else
        {
            this.loadLabels(Array.clone(json.labels));
        }
        
        (function(deltaLists)
        {
            var sortedColChanged = false;
            
            this.trtTable.keepScroll((function()
            {
                deltaLists.torrents.each(function(item)
                {
                    this.totalDL += item[CONST.TORRENT_DOWNSPEED];
                    this.totalUL += item[CONST.TORRENT_UPSPEED];
                    
                    var hash = item[CONST.TORRENT_HASH];
                    var statinfo = this.getStatusInfo(item[CONST.TORRENT_STATUS], item[CONST.TORRENT_PROGRESS]);
                    
                    this.torGroups[hash] = this.getTorGroups(hash);
                    
                    var row = this.trtDataToRow(item);
                    var ret = false;
                    var activeChanged = false;
                    
                    if(has(this.torrents, hash))
                    {
                        // old torrent found, update list
                        var rdata = this.trtTable.rowData[hash];
                        activeChanged = (rdata.hidden == this.torrentIsVisible(hash));
                        
                        if(activeChanged) rdata.hidden = !rdata.hidden;
                        
                        this.trtTable.setIcon(hash, statinfo[0]);
                        
                        row.each(function(v, k)
                        {
                            if(v != rdata.data[k])
                            {
                                ret = this.trtTable.updateCell(hash, k, row) || ret;
                                
                                if(this.trtColDefs[k][0] == "done")
                                {
                                    ret = this.trtTable.updateCell(hash, this.trtColStatusIdx, row) || ret;
                                }
                            }
                        }, this);
                        
                        if(!ret && activeChanged)
                        {
                            this.trtTable._insertRow(hash);
                        }
                    }
                    else
                    {
                        // new torrent found
                        this.trtTable.addRow(row, hash, statinfo[0], !this.torrentIsVisible(hash));
                        ret = true;
                    }
                    
                    this.torrents[hash] = item;
                    sortedColChanged = sortedColChanged || ret;
                }, this);
                
                this.trtTable.requiresRefresh = sortedColChanged || this.trtTable.requiresRefresh;
                
                // handle removed items
                
                var clear = false;
                
                if(window.hdknweb === undefined)
                {
                    deltaLists.torrentm.each(function(key)
                    {
                        Object.each(this.torGroups[key].cat, function(_, cat)
                        {
                            --this.categories[cat];
                        }, this);
                        
                        delete this.torGroups[key];
                        delete this.torrents[key];
                        
                        this.trtTable.removeRow(key);
                        
                        if(this.torrentID == key)
                        {
                            clear = true;
                        }
                    }, this);
                }
                
                if(clear)
                {
                    this.torrentID = "";
                    this.clearDetails();
                }
                
                // calc max torrent job queue number
                var queueMax = -1, q = CONST.TORRENT_QUEUE_POSITION;
                
                Object.each(this.torrents, function(trtData)
                {
                    if(queueMax < trtData[q])
                    {
                        queueMax = trtData[q];
                    }
                });
                
                this.torQueueMax = queueMax;
            }).bind(this));
            
            // finish up
            
            this.trtTable.resizePads();
            
            this.updateLabels();
            this.trtTable.refresh();
        }).bind(this)(extractLists("torrents", "torrentp", "torrentm", CONST.TORRENT_HASH, this.torrents));
        
        json = null;
        
        this.beginPeriodicUpdate();
    },
    
    "loadLabels": function(labels)
    {
        // TODO: remove return
        return;
        
        var labelList = $("mainCatList-labels"), temp = {};
        
        labels.each(function(lbl, idx)
        {
            var label = lbl[0], labelId = "lbl_" + encodeID(label), count = lbl[1], li = null;
            
            if((li = $(labelId)))
            {
                li.getElement(".count").set("text", count);
            }
            else
            {
                labelList.grab(new Element("li", { "id": labelId })
                    .appendText(label + " (")
                    .grab(new Element("span", { "class": "count", "text": count }))
                    .appendText(")")
                );
            }
            
            if(has(this.labels, label))
            {
                delete this.labels[label];
            }
            
            temp[label] = count;
        }, this);
        
        var activeChanged = false;
        
        for(var k in this.labels)
        {
            var id = "lbl_" + encodeID(k);
            
            if(this.config.activeTorGroups.lbl[id])
            {
                activeChanged = true;
            }
            
            delete this.config.activeTorGroups.lbl[id];
            $(id).destroy();
        }
        
        this.labels = temp;
        
        if(activeChanged)
        {
            var activeGroupCount =
            (
                Object.getLength(this.config.activeTorGroups.cat)
              + Object.getLength(this.config.activeTorGroups.lbl)
            );
            
            if(activeGroupCount <= 0)
            {
                this.config.activeTorGroups.cat["cat_all"] = 1;
            }
            
            this.refreshSelectedTorGroups();
        }
    },
    
    "updateLabels": function()
    {
        ["cat_all", "cat_dls", "cat_com", "cat_act", "cat_iac", "cat_nlb"].each(function(cat)
        {
            $(cat + "_c").set("text", this.categories[cat]);
        }, this);
    },
    
    "getSettings": function(fn)
    {
        var act = (function(json)
        {
            this.addSettings(json, fn);
        }).bind(this);
        
        this.request("get", "/api/settings", act);
    },
    
    "addSettings": function(json, fn)
    {
        var loadCookie = (function(newCookie)
        {
            function safeCopy(objOrig, objNew)
            {
                $each(objOrig, function(v, k)
                {
                    var tOrig = typeOf(objOrig[k])
                        tNew  = typeOf(objNew[k]);
                        
                    if(tOrig === tNew)
                    {
                        if(tOrig === "object")
                        {
                            safeCopy(objOrig[k], objNew[k]);
                        }
                        else
                        {
                            objOrig[k] = objNew[k];
                        }
                    }
                });
            }
            
            var cookie = this.config;
            
            newcookie = newcookie || {};
            safecopy(cookie, newcookie);
            
            cookie.activeTorGroups = newcookie.activeTorGroups || this.defConfig.activeTorGroups || {};
            
            if(cookie.activeSettingsPane)
            {
                this.stpanes.show(cookie.activeSettingsPane.replace(/^tab_/, ""));
            }
            
            // set up listviews
            
            if(window.hdknweb === undefined)
            {
                this.trtTable.setConfig({
                    "colSort": [ cookie.torrentTable.sIndex, cookie.torrentTable.reverse ],
                    "colMask": cookie.torrentTable.colMask,
                    "colOrder": cookie.torrentTable.colOrder,
                    "colWidth": cookie.torrentTable.colWidth
                });
                
                this.tableSetMaxRows(cookie.maxRows);
            }
            
            resizeUI();
        }).bind(this);
        var tcmode = 0;
        
        for(var i = 0, j = json.settings.length; i < j; i++)
        {
            var key = json.settings[i][CONST.SETTING_NAME],
                typ = json.settings[i][CONST.SETTING_TYPE],
                val = json.settings[i][CONST.SETTING_VALUE],
                par = json.settings[i][CONST.SETTING_PARAM] || {};
                
            // handle cookie
            if(key === "webui.cookie")
            {
                loadCookie(JSON.decode(val, true));
            }
                
            // convert types
            switch(typ)
            {
                case CONST.SETTINGTYPE_INTEGER: val = val.toInt(); break;
                case CONST.SETTINGTYPE_BOOLEAN: val = (val === "true"); break;
            }
            
            // handle special settings
            // none yet
            
            if(par.access === CONST.SETTINGPARAM_ACCESS_RO)
            {
                var ele = $(key);
                if(ele) ele.addClass("disabled");
            }
            
            this.settings[key] = val;
            _unhideSetting(key);
        }
        
        delete json.settings;
        
        // load language
        if(!(this.config.lang in LANG_LIST))
        {
            var langList = "";
            
            for(var lang in LANG_LIST)
            {
                langList += "|" + lang;
            }
            
            var useLang = (navigator.language ? navigator.language : navigator.userLanguage || "").replace("-", "");
            
            if((useLang = useLang.match(new RegExp(langList.substr(1), "i"))))
            {
                useLang = useLang[0];
            }
            
            if(useLang && (useLang in LANG_LIST))
            {
                this.config.lang = useLang;
            }
            else
            {
                this.config.lang = (this.defConfig.lang || "en");
            }
        }
        
        if(window.hdknweb) return;
        
        loadLangStrings({
            "lang": this.config.lang,
            "onload": (function()
            {
                this.loadSettings();
                
                if(fn) fn();
            }).bind(this)
        });
    },
    
    "refreshSelectedTorGroups": function()
    {
        var deltaGroups;
        
        var oldGroups = this.__refreshSelectedTorGroups_activeTorGroups__;
        
        if(oldGroups)
        {
            var curGroups = this.config.activeTorGroups;
            var changeCount = 0;
            
            deltaGroups = {};
            
            // copy group type
            for(var type in oldGroups) { deltaGroups[type] = {}; }
            for(var type in curGroups) { deltaGroups[type] = {}; }
            
            // removed groups
            for(var type in oldGroups)
            {
                for(var group in oldGroups[type])
                {
                    if(!(group in curGroups[type]))
                    {
                        deltaGroups[type][group] = -1;
                        ++changeCount;
                    }
                }
            }
            
            // added groups
            for(var type in curGroups)
            {
                for(var group in curGroups[type])
                {
                    if(!(group in oldGroups[type]))
                    {
                        deltaGroups[type][group] = 1;
                        ++changeCount;
                    }
                }
            }
            
            if(!changeCount) return;
        }
        
        this.__refreshSelectedTorGroups_activeTorGroups__ = Object.merge({}, this.config.activeTorGroups);
        
        if(!oldGroups)
        {
            deltaGroups = this.config.activeTorGroups;
        }
        
        var val, ele;
        for(var type in deltaGroups)
        {
            for(var group in deltaGroups[type])
            {
                ele = $(group);
                if(!ele) continue;
                
                val = deltaGroups[type][group];
                
                if(val > 0)
                {
                    ele.addClass("sel");
                }
                else if(val < 0)
                {
                    ele.removeClass("sel");
                }
            }
        }
        
        // update detail info pane
        if(this.torrentID != "")
        {
            this.torrentID = "";
            this.clearDetails();
        }
        
        // update torrent jb list
        var activeChanged = false;
        for(var hash in this.torrents)
        {
            var changed = (!!this.trtTable.rowData[hash].hidden === !!this.torrentIsVisible(hash));
            
            if(changed)
            {
                activeChanged = true;
                
                if(this.trtTable.rowData[hash].hidden)
                {
                    this.trtTable.unhideRow(hash);
                }
                else
                {
                    this.trtTable.hideRow(hash);
                }
            }
        }
        
        this.trtTable.clearSelection(activeChanged);
        this.trtTable.curPage = 0;
        
        if(activeChanged)
        {
            this.trtTable.requiresRefresh = true;
            
            this.trtTable.calcSize();
            this.trtTable.restoreScroll();
            this.trtTable.resizePads();
        }
    },
    
    "loadSettings": function()
    {
        this.props.multi =
        {
            "trackers": 0,
            "ulrate": 0,
            "dlrate": 0,
            "superseed": 0,
            "dht": 0,
            "pex": 0,
            "seed_override": 0,
            "seed_ratio": 0,
            "seed_time": 0,
            "ulslots": 0
        };
        
        // TODO: implement advanced settings
        
        // other settings
        
        for(var k in this.settings)
        {
            var ele = $(k);
            if(!ele) continue;
            
            var v = this.settings[k];
            
            if(ele.type == "checkbox")
            {
                ele.checked = !!v;
            }
            else
            {
                switch(k)
                {
                    case "seed_ratio": v /= 10; break;
                    case "seed_time": v /= 60; break;
                }
                
                ele.set("value", v);
            }
            
            ele.fireEvent("change");
            
            if(Browser.ie)
            {
                ele.fireEvent("click");
            }
        }
        
        // webui config
        [ "useSysFont",
          "showDetails",
          "showCategories",
          "showToolbar",
          "showStatusBar",
          "updateInterval",
          "lang" ].each(function(key)
        {
            var ele;
            if(!(ele = $("webui." + key))) return;
            
            var v = this.config[key];
            
            if(ele.type == "checkbox")
            {
                ele.checked = ((v == 1) || (v == true));
            }
            else
            {
                ele.set("value", v);
            }
        }, this);
        
        if(this.config.maxRows < this.limits.minTableRows)
        {
            value = (this.config.maxRows <= 0 ? 0 : this.limits.minTableRows);
        }
        
        var elemaxrows = $("webui.maxRows");
        if(elemaxrows) elemaxrows.set("value", this.config.maxRows);
        
        this.toggleSystemFont(this.config.useSysFont);
        
        // hide toolbar
        if(!this.config.showToolbar) $("mainToolbar").hide();
        
        // hide category lists
        if(!this.config.showCategories) $("mainCatList").hide();
        
        // hide details
        if(!this.config.showDetails) $("mainInfoPane").hide();
        
        // hide tab icons
        if(!this.config.showDetailsIcons) $("mainInfoPane-tabs").removeClass("icon");
        
        // hide statusbar
        if(!this.config.showStatusBar) $("mainStatusBar").hide();
        
        this.toggleSearchBar();
    },
    
    "saveConfig": function(f)
    {
    },
    
    "showDetails": function(id)
    {
        var force = (id !== undefined);
        
        if(force)
        {
            this.torrentID = id;
        }
        else
        {
            id = this.torrentID;
        }
        
        switch(this.mainTabs.active)
        {
            case "mainInfoPane-generalTab":
                this.updateDetails(id);
                break;
                
            case "mainInfoPane-peersTab":
                this.getPeers(id, force);
                break;
                
            case "mainInfoPane-filesTab":
                this.getFiles(id, force);
                break;
        }
    },
    
    "updateTitle": function()
    {
        // TODO
    },
    
    "updateDetails": function(id)
    {
    },
    
    "clearDetails": function()
    {
    },
    
    "showAddTorrent": function()
    {
    },
    
    "showSettings": function()
    {
    },
    
    "showAddUrl": function()
    {
    },
    
    "showAbout": function()
    {
    },
    
    "catListClick": function(ev, k)
    {
    },
    
    "detPanelTabChange": function(id)
    {
    },
    
    "updateToolbar": function()
    {
        var disabled = this.getDisabledActions();
        
        Object.each(disabled, function(disabled, name)
        {
            var item = $(name);
            if(!item) return;
            
            if(disabled)
            {
                item.addClass("disabled");
            }
            else
            {
                item.removeClass("disabled");
            }
        });
    },
    
    "toggleSearchBar": function(show)
    {
        show = (show === undefined ? !!(this.settings["search_list"] || "").trim() : !!show);
        $("mainToolbar-searchbar")[show ? "show" : "hide"]();
    },
    
    "toggleSystemFont": function(use)
    {
        use = (use === undefined ? !this.config.useSysFont : !!use);
        
        document.body[use ? "removeClass" : "addClass"]("nosysfont");
        this.config.useSysFont = use;
        
        resizeUI();
        
        if(Browser.opera) this.saveConfig(true);
    },
    
    "updateStatusBar": function()
    {
    },
    
    "settingsPaneChange": function(id)
    {
    },
    
    "getDisabledActions": function()
    {
        var disabled =
        {
            "start": 1,
            "stop": 1,
            "pause": 1,
            "remove": 1
        };
        
        return disabled;
    }
}

window.WebUI = WebUI;

})(window.jQuery);
import { createReducer } from "redux-act";
import produce from 'immer';
import { setModel, resetModel, addThing, deleteThing } from "../actions";

const initState = { name: "NewModel" };

export default createReducer(
  {
    [setModel]: produce((draft, model) => draft = model),
    [resetModel]: (state) => initState,
    [addThing]: produce((draft, thing) => {
      const things = draft.things;
      let updated = false;
      for (let index = 0; index < things.length; index++) {
        const th = things[index];
        if (th.id === thing.id) {
          // Update things
          draft.things[index] = {...thing};
          updated = true;
          break;
        }
      }
      if (!updated) {
        // Add new thing
        draft.things.push(thing);
      }
    }),
    [deleteThing]: produce((draft, thingID) => {
      const things = draft.things;
      let updated = false;
      for (let index = 0; index < things.length; index++) {
        const th = things[index];
        if (th.id === thingID) {
          // delete thing
          draft.things.splice(index,1);
          updated = true;
          break;
        }
      }
      if (!updated) {
        // error
        console.error(`[ERROR] Cannot find thing: ${thingID}`);
      }
    }),
  },
  initState
);

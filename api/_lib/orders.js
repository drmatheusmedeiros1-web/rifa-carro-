import {rpc} from './store.js';
export async function createOrder(order){
 const result=await rpc('rifa_order_create',{p_order:order});
 if(result!==1)throw Error('Order was not created');
 return result;
}
export const getOrder=id=>rpc('rifa_order_get',{p_id:id});
export const patchOrder=(id,patch)=>rpc('rifa_order_patch',{p_id:id,p_status:patch.status});
export const markPaid=(order,transaction,slug)=>rpc('rifa_order_paid',{p_id:order.id,p_transaction:transaction,p_amount:order.amountCents,p_slug:slug});
export const listOrders=(status,page)=>rpc('rifa_orders_list',{p_status:status,p_page:page});

export const findTicket=number=>rpc('rifa_orders_find',{p_ticket:number});

export const cancelOrder=id=>rpc('rifa_order_cancel',{p_id:id});

export const editOrder=(id,quantity,expectedQuantity)=>rpc('rifa_order_edit',{p_id:id,p_quantity:quantity,p_expected_quantity:expectedQuantity});
